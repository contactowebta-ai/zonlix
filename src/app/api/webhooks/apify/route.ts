/**
 * POST /api/webhooks/apify
 *
 * Recibe el callback de Apify cuando un run de Google Maps termina.
 *
 * Flujo:
 * 1. Verificar secreto compartido en query param ?secret=
 * 2. Validar payload con apifyWebhookPayloadSchema
 * 3. Recuperar searchId de la metadata del payload
 * 4. Descargar resultados del dataset con getDatasetItems
 * 5. Insertar prospectos en `prospects` (user_id del dueño de la búsqueda)
 * 6. Guardar resultado crudo en Redis (cache para búsquedas futuras iguales)
 * 7. Actualizar `searches`: status='completado', total_resultados=N
 * 8. Encolar jobs de auditoría en QStash (uno por prospecto con sitio web)
 * 9. Prospectos sin sitio → audit directo con tier 'verde'
 *
 * Responde 200 inmediatamente — el trabajo ya está encolado.
 */
import { type NextRequest } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { apifyWebhookPayloadSchema } from "@/types/schemas";
import { getDatasetItems } from "@/lib/apify";
import { normalizeSearchKey, setCachedSearch } from "@/lib/redis-cache";
import { enqueueAuditJob } from "@/lib/qstash";
import type { SearchRow } from "@/types/database.types";

export async function POST(request: NextRequest) {
  try {
    // 1. Verificar secreto en header
    const { searchParams } = request.nextUrl;
    const authHeader = request.headers.get("authorization");
    const incomingSecret = authHeader?.split("Bearer ")[1];
    const expectedSecret = process.env.APIFY_WEBHOOK_SECRET;

    if (!expectedSecret || incomingSecret !== expectedSecret) {
      console.warn("[Apify Webhook] Secreto inválido o ausente");
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    // 2. Parsear y validar el payload
    const body = await request.json();
    console.log("[Apify Webhook Body]:", JSON.stringify(body, null, 2));

    const parseResult = apifyWebhookPayloadSchema.safeParse(body);
    if (!parseResult.success) {
      console.error("[Apify Webhook] Payload inválido:", parseResult.error.flatten());
      return Response.json(
        { error: "Payload inválido", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    // Extraer datasetId
    let datasetId = (
      body.resource?.defaultDatasetId ||
      body.eventData?.defaultDatasetId ||
      body.datasetId ||
      body.defaultDatasetId
    ) as string | undefined;

    // Extraer runId (Única fuente de verdad para identificar la búsqueda)
    const runId = (
      body.eventData?.actorRunId ||
      body.resource?.id ||
      body.actorRunId ||
      body.runId
    ) as string | undefined;

    if (!runId) {
      console.error("[Apify Webhook] Error: runId no encontrado en el payload");
      return Response.json({ error: "runId requerido" }, { status: 400 });
    }

    const supabase = createServiceClient();

    // ── CLAIM ATÓMICO (T2) ────────────────────────────────────────
    // Un solo UPDATE con WHERE processing_started_at IS NULL garantiza
    // que, en concurrencia, solo un worker procesa este runId.
    // Si Postgres no devuelve filas → otro worker ya tomó el trabajo.
    const { data: claimedRows, error: claimErr } = await (supabase.from("searches") as any)
      .update({ processing_started_at: new Date().toISOString(), status: "procesando" })
      .eq("apify_run_id", runId)
      .or(`processing_started_at.is.null,processing_started_at.lt.${new Date(Date.now() - 10 * 60000).toISOString()}`)
      .select("id, credits_held")
      .limit(1);

    if (claimErr) {
      console.error(`[Apify Webhook] Error en claim atómico para runId ${runId}:`, claimErr);
      return Response.json({ error: "Error interno al procesar webhook" }, { status: 500 });
    }

    if (!claimedRows || claimedRows.length === 0) {
      // Otro worker ya reclamó este runId (o la búsqueda no existe / ya terminó)
      console.log(`[Apify Webhook] Claim fallido para runId ${runId} — ya procesado por otro worker.`);
      return new Response("Already Processing", { status: 200 });
    }

    const searchId: string = claimedRows[0].id;
    const creditsHeld: number = claimedRows[0].credits_held ?? 0;

    if ((!datasetId || datasetId.includes("{{")) && runId && !runId.includes("{{")) {
      console.log(`[Apify Webhook] Fallback: Consultando API de Apify directamente para el run ${runId}...`);
      const runRes = await fetch(
        `https://api.apify.com/v2/actor-runs/${runId}`, {
          headers: {
            "Authorization": `Bearer ${process.env.APIFY_API_TOKEN}`
          }
        }
      );
      if (runRes.ok) {
        const runData = await runRes.json();
        datasetId = runData.data?.defaultDatasetId;
      }
    }

    if (!datasetId || datasetId.includes("{{")) {
      console.error("[Apify Webhook] Error: No se pudo resolver un datasetId válido:", datasetId);
      return Response.json({ error: "No se pudo resolver un datasetId válido" }, { status: 400 });
    }





    // Usar la función centralizada para descargar, validar, mockear si es necesario y actualizar Supabase
    // Se pasa creditsHeld para que processSearchDataset calcule y ejecute el reembolso por diferencia (T4)
    const { processSearchDataset } = await import("@/lib/apify");
    const totalResultados = await processSearchDataset(searchId, datasetId, creditsHeld);

    console.log(
      `[Apify Webhook] Búsqueda completada — resultados procesados: ${searchId}, total: ${totalResultados}`
    );

    return Response.json({
      message: "Resultados procesados y guardados en staging correctamente",
      total: totalResultados,
      searchId,
    });


  } catch (error) {
    console.error("[Apify Webhook] Error no manejado:", error);
    // Respondemos 200 a Apify para que no reintente el webhook
    return Response.json(
      { error: "Error interno al procesar webhook" },
      { status: 500 }
    );
  }
}

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

    // Extraer searchId de los query params o el body
    const searchId =
      (searchParams.get("searchId") || body.searchId || body.eventData?.searchId) as string | undefined;

    // Extraer datasetId
    let datasetId = (
      body.resource?.defaultDatasetId ||
      body.eventData?.defaultDatasetId ||
      body.datasetId ||
      body.defaultDatasetId
    ) as string | undefined;

    // Fallback de seguridad: si datasetId es undefined o incluye '{{', hacer fetch a la API de Apify usando actorRunId
    const runId = (
      body.eventData?.actorRunId ||
      body.resource?.id ||
      body.actorRunId ||
      body.runId
    ) as string | undefined;

    if (runId) {
      const supabase = createServiceClient();
      const { data: searchStatusRow, error: statusErr } = await (supabase.from("searches") as any)
        .select("status")
        .eq("apify_run_id", runId)
        .single();
        
      if (!statusErr && searchStatusRow) {
        if (searchStatusRow.status === "completado" || searchStatusRow.status === "error") {
          console.log(`[Apify Webhook] Ignorando webhook repetido para runId ${runId} (status: ${searchStatusRow.status})`);
          return new Response('Already processed', { status: 200 });
        }
      }
    }

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

    if (!searchId) {
      console.error("[Apify Webhook] Error: searchId no encontrado ni en query params ni en body");
      return Response.json({ error: "searchId requerido" }, { status: 400 });
    }

    if (!datasetId || datasetId.includes("{{")) {
      console.error("[Apify Webhook] Error: No se pudo resolver un datasetId válido:", datasetId);
      return Response.json({ error: "No se pudo resolver un datasetId válido" }, { status: 400 });
    }





    // Usar la función centralizada para descargar, validar, mockear si es necesario y actualizar Supabase
    const { processSearchDataset } = await import("@/lib/apify");
    const totalResultados = await processSearchDataset(searchId, datasetId);

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

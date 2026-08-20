/**
 * POST /api/jobs/audit-prospect
 *
 * Job individual de auditoría de un prospecto. Entregado por QStash.
 *
 * Flujo:
 * 1. Verificar firma de QStash con verifySignatureAppRouter
 * 2. Cargar prospecto + profile del usuario desde Supabase
 * 3. Firecrawl: scrape del sitio web a Markdown
 * 4. Gemini: auditWebsite → guardar en `audits`
 * 5. Gemini: generateMessages → guardar 3 filas en `messages`
 * 6. Si falla cualquier paso: guardar audit parcial en lugar de dejar al prospecto sin diagnóstico
 *
 * Cada prospecto es un job aislado — un fallo nunca bloquea a los demás.
 */
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { createServiceClient } from "@/lib/supabase/server";
import { auditJobSchema } from "@/types/schemas";
import { scrapeToMarkdown } from "@/lib/firecrawl";
import { auditWebsite, generateMessages } from "@/lib/gemini";
import type { GeminiAuditResponse } from "@/types/schemas";
import type { ProspectRow, ProfileRow } from "@/types/database.types";

// ============================================
// HANDLER PRINCIPAL (envuelto con verifySignatureAppRouter)
// ============================================

async function handler(request: Request) {
  const supabase = createServiceClient();

  // 1. Parsear y validar body
  const body = await request.json();
  const parseResult = auditJobSchema.safeParse(body);

  if (!parseResult.success) {
    console.error("[audit-prospect] Body inválido:", parseResult.error.flatten());
    // 400 → QStash NO reintentará (error permanente del cliente)
    return Response.json(
      { error: "Body inválido", details: parseResult.error.flatten() },
      { status: 400 }
    );
  }

  const { prospectId } = parseResult.data;

  // 2. Cargar prospecto
  const { data: prospectRaw, error: prospectError } = await (supabase.from("prospects") as any)
    .select("*")
    .eq("id", prospectId)
    .single();

  const prospect = prospectRaw as ProspectRow | null;

  if (prospectError || !prospect) {
    console.error(`[audit-prospect] Prospecto no encontrado: ${prospectId}`);
    return Response.json(
      { error: "Prospecto no encontrado" },
      { status: 404 }
    );
  }

  // 3. Cargar profile del usuario dueño del prospecto
  const { data: profileRaw, error: profileError } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", prospect.user_id)
    .single();

  const profile = profileRaw as ProfileRow | null;

  if (profileError || !profile) {
    console.error(`[audit-prospect] Profile no encontrado para user: ${prospect.user_id}`);
    return Response.json(
      { error: "Profile del usuario no encontrado" },
      { status: 404 }
    );
  }

  // 4. Firecrawl: scrape → markdown (null si falla)
  let markdown: string | null = null;
  if (prospect.sitio_web) {
    markdown = await scrapeToMarkdown(prospect.sitio_web);
  }

  // 5. Gemini: auditoría de presencia digital
  let auditResult: GeminiAuditResponse | null = null;
  let auditError: string | null = null;

  try {
    auditResult = await auditWebsite(markdown, prospect);
  } catch (error) {
    auditError = error instanceof Error ? error.message : "Error desconocido en Gemini";
    console.error(`[audit-prospect] Error en auditWebsite para ${prospectId}:`, error);
  }

  // 6. Guardar en `audits` (parcial si hubo error)
  const auditPayload = auditResult
    ? {
        prospect_id: prospectId,
        user_id: prospect.user_id,
        score: auditResult.score,
        tier: auditResult.tier,
        puntos_dolor: auditResult.puntos_dolor,
        markdown_crudo: markdown,
        resumen_ia: auditResult.resumen_ia,
        analizado_at: new Date().toISOString(),
      }
    : {
        prospect_id: prospectId,
        user_id: prospect.user_id,
        score: null,
        tier: null,
        puntos_dolor: [],
        markdown_crudo: markdown,
        resumen_ia: "No se pudo generar el diagnóstico en este momento. Por favor, intenta de nuevo más tarde.",
        analizado_at: new Date().toISOString(),
      };

  const { data: savedAuditRaw, error: auditInsertError } = await (supabase.from("audits") as any)
    .upsert(auditPayload, { onConflict: "prospect_id" })
    .select("id")
    .single();

  const savedAudit = savedAuditRaw as { id: string } | null;

  if (auditInsertError) {
    console.error(`[audit-prospect] Error al guardar audit para ${prospectId}:`, auditInsertError);
    // 500 → QStash reintentará (error transitorio)
    return Response.json(
      { error: "Error al guardar auditoría en base de datos" },
      { status: 500 }
    );
  }

  // Si la auditoría falló, no generamos mensajes (no tenemos puntos de dolor)
  if (!auditResult) {
    return Response.json({
      message: "Auditoría guardada con error parcial — sin mensajes generados",
      prospectId,
      auditId: savedAudit?.id,
    });
  }

  // 7. Gemini: generar mensajes por canal
  try {
    const messages = await generateMessages(profile, prospect, auditResult);

    // 8. Guardar 3 filas en `messages` (una por canal)
    const messagesToInsert = [
      {
        prospect_id: prospectId,
        user_id: prospect.user_id,
        canal: "whatsapp" as const,
        contenido: messages.whatsapp,
        enviado: false,
      },
      {
        prospect_id: prospectId,
        user_id: prospect.user_id,
        canal: "email" as const,
        contenido: `Asunto: ${messages.email.asunto}\n\n${messages.email.cuerpo}`,
        variante: messages.email.asunto,
        enviado: false,
      },
      {
        prospect_id: prospectId,
        user_id: prospect.user_id,
        canal: "llamada" as const,
        contenido: messages.guion_telefonico,
        enviado: false,
      },
    ];

    const { error: messagesError } = await (supabase.from("messages") as any)
      .insert(messagesToInsert);

    if (messagesError) {
      console.error(
        `[audit-prospect] Error al guardar mensajes para ${prospectId}:`,
        messagesError
      );
      // No fallamos el job completo — la auditoría ya se guardó correctamente
    }

    console.log(
      `[audit-prospect] ✅ Completado — prospecto: ${prospectId}, score: ${auditResult.score}, tier: ${auditResult.tier}`
    );

    return Response.json({
      message: "Auditoría y mensajes generados correctamente",
      prospectId,
      auditId: savedAudit?.id,
      score: auditResult.score,
      tier: auditResult.tier,
    });

  } catch (error) {
    console.error(
      `[audit-prospect] Error en generateMessages para ${prospectId}:`,
      error
    );
    // La auditoría ya fue guardada — respondemos éxito parcial
    return Response.json({
      message: "Auditoría guardada. Error al generar mensajes.",
      prospectId,
      auditId: savedAudit?.id,
      score: auditResult.score,
      tier: auditResult.tier,
    });
  }
}

// Exportar el handler envuelto en la verificación de firma de QStash
export const POST = verifySignatureAppRouter(handler);


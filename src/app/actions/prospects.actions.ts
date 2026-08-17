"use server";

/**
 * src/app/actions/prospects.actions.ts
 *
 * Server Actions para gestión y actualización de prospectos y sus mensajes.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { prospectStatusSchema, type ActionResult, type ProspectStatus } from "@/types";
import { calculateSearchCreditCost, calculateAuditCreditCost } from "@/lib/credits";

import { revalidatePath } from "next/cache";
import type { ProfileRow, ProspectRow } from "@/types/database.types";
import type { ApifyPlace } from "@/types/schemas";

export async function pushToCrm(prospectId: string): Promise<ActionResult<void>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    
    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { error } = await (supabase.from("prospects") as any)
      .update({ status: "nuevo" })
      .eq("id", prospectId)
      .eq("user_id", user.id);

    if (error) throw error;

    revalidatePath("/prospectos");
    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/crm");

    return { success: true };
  } catch (err: any) {
    console.error("[pushToCrm] Error:", err);
    return { success: false, error: "Error al agregar al CRM" };
  }
}

/**
 * Fallback: verifica el estado del run de Apify directamente y,
 * si ya terminó, descarga el dataset y actualiza la búsqueda en Supabase.
 * Se usa como respaldo cuando el webhook no llega (ej. entorno local, problemas de red).
 */
export async function checkSearchFallback(searchId: string): Promise<ActionResult<any>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Obtener la búsqueda con sus IDs de Apify
    const { data: searchRow, error: searchError } = await (supabase.from("searches") as any)
      .select("id, status, apify_run_id, apify_dataset_id, query, ubicacion, results_json")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    if (searchError || !searchRow) {
      if (searchError) {
        console.error("[checkSearchFallback] Supabase Select Error:", {
          message: searchError.message,
          details: searchError.details,
          hint: searchError.hint,
          code: searchError.code
        });
      }
      return { success: false, error: "Búsqueda no encontrada" };
    }


    // Si ya está completada y tiene resultados, simplemente retornar éxito
    if (searchRow.status === "completado" && Array.isArray(searchRow.results_json) && searchRow.results_json.length > 0) {
      return { success: true, data: { status: "completado", count: searchRow.results_json.length } };
    }

    // Si no tenemos run_id, no podemos hacer fallback
    const runId = searchRow.apify_run_id;
    let datasetId = searchRow.apify_dataset_id;

    if (!runId) {
      return { success: false, error: "Sin run_id de Apify registrado" };
    }

    // 2. Consultar el estado del run directamente en la API de Apify
    const APIFY_TOKEN = process.env.APIFY_API_TOKEN;
    const runRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}`,
      {
        cache: "no-store",
        headers: { "Authorization": `Bearer ${APIFY_TOKEN}` },
      }
    );

    if (!runRes.ok) {
      return { success: false, error: `Error consultando Apify run: HTTP ${runRes.status}` };
    }

    const runData = await runRes.json();
    const runStatus = runData.data?.status;

    console.log(`[checkSearchFallback] Run ${runId} status: ${runStatus}`);

    if (runStatus !== "SUCCEEDED") {
      // Aún procesando o falló
      if (runStatus === "FAILED" || runStatus === "TIMED-OUT" || runStatus === "ABORTED") {
        const adminSupabase = createServiceClient();
        await (adminSupabase.from("searches") as any)
          .update({ status: "error", error_mensaje: `Apify run terminó con estado: ${runStatus}` })
          .eq("id", searchId);
        return { success: false, error: `Apify run terminó con estado: ${runStatus}` };
      }
      
      // Consultar avance parcial
      let partialCount = 0;
      const partialDatasetId = runData.data?.defaultDatasetId || datasetId;
      if (partialDatasetId) {
        try {
          const { getDatasetItems } = await import("@/lib/apify");
          const items = await getDatasetItems(partialDatasetId);
          partialCount = items.length;
        } catch (e) {
          console.warn("[checkSearchFallback] No se pudo obtener avance parcial:", e);
        }
      }
      
      return { success: true, data: { status: "procesando", apifyStatus: runStatus, partialCount } };
    }

    // 3. Run exitoso — obtener datasetId si no lo teníamos
    if (!datasetId) {
      datasetId = runData.data?.defaultDatasetId;
    }

    if (!datasetId) {
      return { success: false, error: "No se pudo resolver el datasetId del run de Apify" };
    }

    // 4. Procesar el dataset directamente
    const { processSearchDataset } = await import("@/lib/apify");
    const count = await processSearchDataset(searchId, datasetId);

    const adminSupabase = createServiceClient();
    await (adminSupabase.from("searches") as any)
      .update({ apify_dataset_id: datasetId })
      .eq("id", searchId);

    revalidatePath("/buscar");
    revalidatePath(`/prospectos`);
    revalidatePath("/", "layout");

    return { success: true, data: { status: "completado", count } };
  } catch (err) {
    console.error("[checkSearchFallback] Error:", err);
    return { success: false, error: err instanceof Error ? err.message : "Error inesperado" };
  }
}


export async function updateProspectStatus(
  prospectId: string,
  newStatus: ProspectStatus
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const parseResult = prospectStatusSchema.safeParse(newStatus);
    if (!parseResult.success) {
      return { success: false, error: "Estado no válido" };
    }

    const { error } = await (supabase.from("prospects") as any)
      .update({ status: newStatus, updated_at: new Date().toISOString() })
      .eq("id", prospectId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/prospectos");
    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/crm");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al actualizar estado",
    };
  }
}

export async function marcarComoContactado(prospectId: string): Promise<ActionResult> {
  return updateProspectStatus(prospectId, "contactado");
}

export async function updateMessageContent(
  messageId: string,
  contenido: string
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    if (!contenido.trim()) {
      return { success: false, error: "El contenido del mensaje no puede estar vacío" };
    }

    const { error } = await (supabase.from("messages") as any)
      .update({ contenido: contenido.trim() })
      .eq("id", messageId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/prospectos");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar el mensaje",
    };
  }
}

export async function importProspectToCRM(
  searchId: string,
  place: Partial<ApifyPlace>
): Promise<ActionResult<{ prospectId: string; alreadyImported?: boolean }>> {
  let appliedCost = 0;
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    // 1. Cargar perfil del usuario
    const { data: profileRaw } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = profileRaw as ProfileRow | null;

    if (!profile || typeof profile.credits_remaining !== 'number') { 
      return { success: false, error: "No se pudo verificar el saldo de créditos. Intenta de nuevo." }; 
    }

    const resolvedTitle = String(place.title || place.name || "Sin nombre");

    // 2. Verificar si ya fue importado en `prospects`
    const { data: existingProspects } = await (supabase.from("prospects") as any)
      .select("id, nombre_empresa")
      .eq("user_id", user.id)
      .eq("nombre_empresa", resolvedTitle);

    if (existingProspects && existingProspects.length > 0) {
      return {
        success: true,
        data: { prospectId: existingProspects[0].id, alreadyImported: true },
      };
    }

    // 3. Inserción individual en `prospects`
    const { data: insertedProspectRaw, error: prospectError } = await (
      supabase.from("prospects") as any
    )
      .insert({
        user_id: user.id,
        search_id: searchId,
        nombre_empresa: resolvedTitle,

        telefono: place.phone ? String(place.phone) : null,
        sitio_web: place.website ?? null,
        direccion: place.address ?? null,
        calificacion_google: place.totalScore ? Number(place.totalScore) : null,
        num_resenas: place.reviewsCount ? Number(place.reviewsCount) : null,
        status: "nuevo",
      })
      .select("*")
      .single();

    if (prospectError || !insertedProspectRaw) {
      return {
        success: false,
        error: `Error al importar prospecto: ${prospectError?.message || "desconocido"}`,
      };
    }

    const prospect = insertedProspectRaw as ProspectRow;

    // 3.5 Búsqueda secundaria de redes sociales si faltan
    const { findSocialMedia } = await import("@/lib/social-finder");
    const socialResult = await findSocialMedia(prospect.nombre_empresa, prospect.direccion);
    if (socialResult.facebook_url || socialResult.instagram_url) {
      await (supabase.from("prospects") as any)
        .update({
          facebook_url: socialResult.facebook_url,
          instagram_url: socialResult.instagram_url,
        })
        .eq("id", prospect.id)
        .eq("user_id", user.id);
      prospect.facebook_url = socialResult.facebook_url;
      prospect.instagram_url = socialResult.instagram_url;
    }

    // 3.9 Verificar créditos antes del pipeline IA (optimistic lock)
    const auditCost = calculateAuditCreditCost(Boolean(prospect.sitio_web));
    if (profile && typeof profile.credits_remaining === 'number') {
      const serviceClient = createServiceClient();
      const { data: newBalance, error: rpcError } = await (serviceClient as any)
        .rpc('decrement_credits', { p_user_id: user.id, p_amount: auditCost });
        
      if (rpcError || newBalance === null) {
        return { success: false, error: "INSUFFICIENT_CREDITS" };
      }
      appliedCost = auditCost;
    }

    // 4. Scrape + Auditoría para este prospecto
    const { scrapeToMarkdown } = await import("@/lib/firecrawl");
    const { auditWebsite } = await import("@/lib/gemini");

    let markdown: string | null = null;
    if (prospect.sitio_web) {
      markdown = await scrapeToMarkdown(prospect.sitio_web);
    }


    const auditResult = await auditWebsite(markdown, prospect);

    // Guardar auditoría
    await (supabase.from("audits") as any).upsert(
      {
        prospect_id: prospect.id,
        user_id: user.id,
        score: auditResult.score,
        tier: auditResult.tier,
        puntos_dolor: auditResult.puntos_dolor,
        markdown_crudo: markdown,
        resumen_ia: auditResult.resumen_ia,
        analizado_at: new Date().toISOString(),
      },
      { onConflict: "prospect_id" }
    );

    revalidatePath("/prospectos");
    revalidatePath(`/prospectos/${prospect.id}`);
    revalidatePath("/crm");
    revalidatePath("/buscar");
    revalidatePath("/", "layout");

    return {
      success: true,
      data: { prospectId: prospect.id },
    };
  } catch (err: any) {
    if (appliedCost > 0) {
      const serviceClient = createServiceClient();
      const { data: { user } } = await createClient().then(c => c.auth.getUser());
      if (user) {
        await (serviceClient as any).rpc('increment_credits', { p_user_id: user.id, p_amount: appliedCost });
      }
    }

    if (err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("rate limit")) {
      return { success: false, error: "Has alcanzado el límite de consultas por minuto. Espera 1 minuto y haz clic en 'Reintentar Auditoría'." };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al importar prospecto",
    };
  }
}

export async function refetchSocialMedia(
  prospectId: string
): Promise<ActionResult<{ facebook_url: string | null; instagram_url: string | null }>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { data: prospectRaw, error: fetchError } = await (supabase.from("prospects") as any)
      .select("id, nombre_empresa, direccion")
      .eq("id", prospectId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !prospectRaw) {
      return { success: false, error: "Prospecto no encontrado" };
    }

    const { findSocialMedia } = await import("@/lib/social-finder");
    const socialResult = await findSocialMedia(
      prospectRaw.nombre_empresa,
      prospectRaw.direccion
    );

    if (socialResult.facebook_url || socialResult.instagram_url) {
      await (supabase.from("prospects") as any)
        .update({
          facebook_url: socialResult.facebook_url,
          instagram_url: socialResult.instagram_url,
        })
        .eq("id", prospectId)
        .eq("user_id", user.id);

      revalidatePath(`/prospectos/${prospectId}`);
      revalidatePath("/prospectos");
      revalidatePath("/crm");
    }

    return {
      success: true,
      data: socialResult,
    };
  } catch (err: any) {
    if (err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("rate limit")) {
      return { success: false, error: "Has alcanzado el límite de consultas por minuto. Espera 1 minuto y haz clic en 'Reintentar Auditoría'." };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al buscar redes sociales",
    };
  }
}

export async function updateSocialMediaUrls(
  prospectId: string,
  facebookUrl: string | null,
  instagramUrl: string | null
): Promise<ActionResult> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { error } = await (supabase.from("prospects") as any)
      .update({
        facebook_url: facebookUrl ? facebookUrl.trim() : null,
        instagram_url: instagramUrl ? instagramUrl.trim() : null,
      })
      .eq("id", prospectId)
      .eq("user_id", user.id);

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/prospectos");
    revalidatePath("/crm");

    return { success: true };
  } catch (err: any) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al guardar redes sociales",
    };
  }
}

export async function retryAudit(prospectId: string): Promise<ActionResult> {
  let appliedCost = 0;
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { data: prospectRaw, error: fetchError } = await (supabase.from("prospects") as any)
      .select("*")
      .eq("id", prospectId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !prospectRaw) {
      return { success: false, error: "Prospecto no encontrado" };
    }
    const prospect = prospectRaw as ProspectRow;

    // 1. Cargar perfil
    const { data: profileRaw } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();
    const profile = profileRaw as ProfileRow | null;

    if (!profile || typeof profile.credits_remaining !== 'number') { 
      return { success: false, error: "No se pudo verificar el saldo de créditos. Intenta de nuevo." }; 
    }

    // 1.5 Verificar créditos antes del pipeline IA (optimistic lock)
    const auditCost = calculateAuditCreditCost(Boolean(prospect.sitio_web));
    if (profile && typeof profile.credits_remaining === 'number') {
      const serviceClient = createServiceClient();
      const { data: newBalance, error: rpcError } = await (serviceClient as any)
        .rpc('decrement_credits', { p_user_id: user.id, p_amount: auditCost });
        
      if (rpcError || newBalance === null) {
        return { success: false, error: "INSUFFICIENT_CREDITS" };
      }
      appliedCost = auditCost;
    }

    // 2. Scrape y Auditoría
    const { scrapeToMarkdown } = await import("@/lib/firecrawl");
    const { auditWebsite } = await import("@/lib/gemini");

    let markdown: string | null = null;
    if (prospect.sitio_web) {
      markdown = await scrapeToMarkdown(prospect.sitio_web);
    }

    const auditResult = await auditWebsite(markdown, prospect);

    // Guardar auditoría
    await (supabase.from("audits") as any).upsert(
      {
        prospect_id: prospect.id,
        user_id: user.id,
        score: auditResult.score,
        tier: auditResult.tier,
        puntos_dolor: auditResult.puntos_dolor,
        markdown_crudo: markdown,
        resumen_ia: auditResult.resumen_ia,
        analizado_at: new Date().toISOString(),
      },
      { onConflict: "prospect_id" }
    );

    revalidatePath(`/prospectos/${prospect.id}`);
    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (err: any) {
    if (appliedCost > 0) {
      const serviceClient = createServiceClient();
      const { data: { user } } = await createClient().then(c => c.auth.getUser());
      if (user) {
        await (serviceClient as any).rpc('increment_credits', { p_user_id: user.id, p_amount: appliedCost });
      }
    }

    if (err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("rate limit")) {
      return { success: false, error: "Has alcanzado el límite de consultas por minuto. Espera 1 minuto y haz clic en 'Reintentar Auditoría'." };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al reintentar auditoría",
    };
  }
}

export async function generateOnDemandProspectMessage(prospectId: string): Promise<ActionResult & { messages?: any }> {
  let appliedCost = 0;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: "No autenticado" };

    const { data: prospectRaw, error: prospectError } = await (supabase.from("prospects") as any)
      .select("*")
      .eq("id", prospectId)
      .eq("user_id", user.id)
      .single();

    if (prospectError || !prospectRaw) return { success: false, error: "Prospecto no encontrado" };
    const prospect = prospectRaw as ProspectRow;

    const { data: profileRaw } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();
    if (!profileRaw) return { success: false, error: "Perfil no encontrado" };
    const profile = profileRaw as ProfileRow;

    const { data: auditRaw } = await (supabase.from("audits") as any)
      .select("*")
      .eq("prospect_id", prospectId)
      .single();
    if (!auditRaw) return { success: false, error: "Auditoría no encontrada. Por favor, realiza una auditoría primero." };
    const audit = auditRaw;

    // Bloqueo optimista (1 crédito por generación)
    const cost = 1;
    if (typeof profile.credits_remaining === 'number') {
      const serviceClient = createServiceClient();
      const { data: newBalance, error: rpcError } = await (serviceClient as any)
        .rpc('decrement_credits', { p_user_id: user.id, p_amount: cost });
        
      if (rpcError || newBalance === null) {
        return { success: false, error: "INSUFFICIENT_CREDITS" };
      }
      appliedCost = cost;
    }

    const { generateMessages } = await import("@/lib/gemini");
    const messages = await generateMessages(profile, prospect, audit);

    const messagesToInsert = [
      {
        prospect_id: prospect.id,
        user_id: user.id,
        canal: "whatsapp" as const,
        contenido: messages.whatsapp,
        enviado: false,
      },
      {
        prospect_id: prospect.id,
        user_id: user.id,
        canal: "email" as const,
        contenido: `Asunto: ${messages.email.asunto}\n\n${messages.email.cuerpo}`,
        variante: messages.email.asunto,
        enviado: false,
      },
      {
        prospect_id: prospect.id,
        user_id: user.id,
        canal: "llamada" as const,
        contenido: messages.guion_telefonico,
        enviado: false,
      },
    ];

    // Primero borramos los anteriores por si es una re-generación
    await (supabase.from("messages") as any).delete().eq("prospect_id", prospectId).eq("user_id", user.id);
    
    // Y luego insertamos los nuevos
    await (supabase.from("messages") as any).insert(messagesToInsert);

    revalidatePath(`/prospectos/${prospectId}`);
    return { success: true, messages };
  } catch (err: any) {
    if (appliedCost > 0) {
      const serviceClient = createServiceClient();
      const { data: { user } } = await createClient().then(c => c.auth.getUser());
      if (user) {
        await (serviceClient as any).rpc('increment_credits', { p_user_id: user.id, p_amount: appliedCost });
      }
    }

    console.error("[generateOnDemand] Error:", err);
    return { success: false, error: "Error al generar mensajes. Tu crédito fue devuelto." };
  }
}

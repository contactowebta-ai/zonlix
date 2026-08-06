"use server";

/**
 * src/app/actions/prospects.actions.ts
 *
 * Server Actions para gestión y actualización de prospectos y sus mensajes.
 */
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/server";
import { prospectStatusSchema, type ActionResult, type ProspectStatus } from "@/types";

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
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`,
      { cache: "no-store" }
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
      return { success: true, data: { status: "procesando", apifyStatus: runStatus } };
    }

    // 3. Run exitoso — obtener datasetId si no lo teníamos
    if (!datasetId) {
      datasetId = runData.data?.defaultDatasetId;
    }

    if (!datasetId) {
      return { success: false, error: "No se pudo resolver el datasetId del run de Apify" };
    }

    // 4. Descargar el dataset directamente
    const { getDatasetItems } = await import("@/lib/apify");
    const places = await getDatasetItems(datasetId);
    console.log(`[checkSearchFallback] Dataset fetched: ${places.length} items`);

    // 5. Mapear a formato limpio
    let cleanItems = (places || []).map((item: any) => ({
      placeId: item.placeId || item.id || String(Math.random()),
      title: item.title || item.name || "Sin nombre",
      categoryName: item.categoryName || item.category || searchRow.query || "",
      address: item.address || item.street || "",
      city: searchRow.ubicacion || "",
      phone: item.phone || item.phoneUnformatted || "",
      website: item.website || item.domain || null,
      totalScore: item.totalScore || item.stars || 0,
      reviewsCount: item.reviewsCount || item.reviews || 0,
      url: item.url || item.googleMapsUrl || "",
      location: item.location || null,
    }));

    let parsedJson: any = {};
    if (typeof searchRow.results_json === "string") {
      try { parsedJson = JSON.parse(searchRow.results_json); } catch(e) {}
    } else {
      parsedJson = searchRow.results_json || {};
    }
    const originalLimit = parsedJson?._limit || 20;

    const adminSupabase = createServiceClient();
    
    // Buscar searches previas para extraer placeIds históricos y deduplicar GLOBALMENTE
    const { data: pastSearches } = await (adminSupabase.from("searches") as any)
      .select("results_json")
      .eq("user_id", user.id)
      .neq("id", searchId);

    const historicalPlaceIds = new Set<string>();
    if (pastSearches) {
      for (const search of pastSearches) {
        const arr = Array.isArray(search.results_json) ? search.results_json : (search.results_json as any)?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item.placeId) historicalPlaceIds.add(item.placeId);
          }
        }
      }
    }

    // Filtrar duplicados históricos estrictamente
    cleanItems = cleanItems.filter((item: any) => !historicalPlaceIds.has(item.placeId));

    // Aplicar recorte estricto sobre prospectos NUEVOS
    const slicedItems = cleanItems.slice(0, originalLimit);

    const calculateSearchCreditCost = (limit: number): number => {
      if (limit <= 0) return 0;
      return Math.ceil(limit / 5);
    };

    const actualCost = calculateSearchCreditCost(slicedItems.length);

    if (actualCost > 0) {
      const { data: profile } = await (adminSupabase.from("profiles") as any).select("credits_remaining").eq("id", user.id).single();
      if (profile) {
        await (adminSupabase.from("profiles") as any).update({ credits_remaining: profile.credits_remaining - actualCost }).eq("id", user.id);
      }
    }

    const originalQuery = (searchRow.results_json as any)?.originalQuery;
    const originalLocation = (searchRow.results_json as any)?.originalLocation;

    // 6. Actualizar en Supabase con service client (bypasa RLS)
    const { error: updateError } = await (adminSupabase.from("searches") as any)
      .update({
        status: "completado",
        total_resultados: slicedItems.length,
        results_json: { data: slicedItems, _limit: originalLimit, originalQuery, originalLocation },
        apify_dataset_id: datasetId,
      })
      .eq("id", searchId);

    if (updateError) {
      console.error("[checkSearchFallback] Supabase update error:", {
        message: updateError.message,
        details: updateError.details,
        hint: updateError.hint,
        code: updateError.code
      });
      return { success: false, error: "Error al guardar resultados en Supabase" };
    }


    revalidatePath("/buscar");
    revalidatePath(`/prospectos`);
    revalidatePath("/", "layout");

    return { success: true, data: { status: "completado", count: slicedItems.length } };
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
        .eq("id", prospect.id);
      prospect.facebook_url = socialResult.facebook_url;
      prospect.instagram_url = socialResult.instagram_url;
    }

    // 4. Scrape + Auditoría + Generación de mensajes bajo demanda para este prospecto
    const { scrapeToMarkdown } = await import("@/lib/firecrawl");
    const { auditWebsite, generateMessages } = await import("@/lib/gemini");

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

    // Generar mensajes si hay perfil
    if (profile) {
      const messages = await generateMessages(profile, prospect, auditResult);
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

      await (supabase.from("messages") as any).insert(messagesToInsert);
    }

    if (profile && typeof profile.credits_remaining === 'number') {
      await (supabase.from("profiles") as any)
        .update({ credits_remaining: Math.max(0, profile.credits_remaining - 1) })
        .eq("id", user.id);
    }

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

    // 2. Scrape y Auditoría
    const { scrapeToMarkdown } = await import("@/lib/firecrawl");
    const { auditWebsite, generateMessages } = await import("@/lib/gemini");

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

    // Generar mensajes
    if (profile) {
      const messages = await generateMessages(profile, prospect, auditResult);
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
      
      // Eliminar mensajes anteriores si existen
      await (supabase.from("messages") as any).delete().eq("prospect_id", prospect.id);
      await (supabase.from("messages") as any).insert(messagesToInsert);
    }

    if (profile && typeof profile.credits_remaining === 'number') {
      await (supabase.from("profiles") as any)
        .update({ credits_remaining: Math.max(0, profile.credits_remaining - 1) })
        .eq("id", user.id);
    }

    revalidatePath(`/prospectos/${prospect.id}`);
    revalidatePath("/", "layout");
    
    return { success: true };
  } catch (err: any) {
    if (err?.message?.includes("429") || err?.message?.includes("quota") || err?.message?.includes("rate limit")) {
      return { success: false, error: "Has alcanzado el límite de consultas por minuto. Espera 1 minuto y haz clic en 'Reintentar Auditoría'." };
    }
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al reintentar auditoría",
    };
  }
}

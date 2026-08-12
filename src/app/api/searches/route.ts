/**
 * POST /api/searches
 *
 * Crea una nueva búsqueda de prospección.
 *
 * Flujo:
 * 1. Autenticar usuario con Supabase
 * 2. Validar body con createSearchSchema
 * 3. Insertar en `searches` con status 'pendiente'
 * 4. Chequear Redis:
 *    - HIT  → insertar prospectos del caché, encolar auditorías, status 'completado'
 *    - MISS → lanzar Apify async, status 'procesando'
 * 5. Responder inmediatamente (el trabajo pesado ocurre vía webhook/QStash)
 *
 * GET /api/searches
 * Lista las búsquedas del usuario autenticado.
 */
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createSearchSchema } from "@/types/schemas";
import { normalizeSearchKey, getCachedSearch } from "@/lib/redis-cache";
import { startGoogleMapsSearch } from "@/lib/apify";
import { enqueueAuditJob } from "@/lib/qstash";
import { revalidatePath } from "next/cache";
import { interpretSearchInput } from "@/lib/gemini";
import type { ApifyPlace } from "@/types/schemas";
import type { SearchRow, ProspectRow } from "@/types/database.types";

const calculateSearchCreditCost = (limit: number): number => {
  if (limit <= 0) return 0;
  return Math.ceil(limit / 5);
};

// ============================================
// GET — lista de búsquedas del usuario
// ============================================

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const searchId = searchParams.get("searchId");

    if (searchId) {
      const { data: searchRow } = await (supabase.from("searches") as any)
        .select("*")
        .eq("id", searchId)
        .eq("user_id", user.id)
        .single();

      return Response.json({ data: searchRow as SearchRow | null });
    }

    const { data: searches, error } = await (supabase.from("searches") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      console.error("[GET /api/searches] Supabase Error:", {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      throw error;
    }

    return Response.json({ data: searches as SearchRow[] });
  } catch (error: any) {
    console.error("[GET /api/searches] Unexpected Error:", error?.message || error);
    return Response.json(
      { error: "Error al obtener búsquedas" },
      { status: 500 }
    );
  }
}

// ============================================
// POST — crear nueva búsqueda
// ============================================

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  let searchId: string | null = null;

  try {
    // 1. Autenticar usuario
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return Response.json({ error: "No autorizado" }, { status: 401 });
    }

    // 1.5 Validar créditos del usuario
    const { data: profile, error: profileError } = await (supabase.from("profiles") as any)
      .select("credits_remaining")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: "No se pudo obtener el perfil del usuario" }, { status: 500 });
    }

    if (profile.credits_remaining <= 0) {
      return Response.json(
        { error: "INSUFFICIENT_CREDITS", message: "Has consumido tus créditos. Espera a tu fecha de renovación o contacta a soporte para un upgrade." },
        { status: 403 }
      );
    }

    // 2. Validar body
    const body = await request.json();
    const parseResult = createSearchSchema.safeParse(body);

    if (!parseResult.success) {
      return Response.json(
        { error: "Datos inválidos", details: parseResult.error.flatten() },
        { status: 400 }
      );
    }

    const { query, ubicacion, limit = 20 } = parseResult.data;

    // BLOQUEO DE PROMPT INJECTION / XSS (PRE-BÚSQUEDA)
    const isSuspicious = (text: string) => /ignora|instrucciones|system prompt|override|<script>|select|drop table|<|>/i.test(text);
    if (isSuspicious(query) || isSuspicious(ubicacion || "")) {
      return Response.json(
        { error: "Término de búsqueda no permitido. Por favor ingresa una categoría de negocio válida sin símbolos o comandos." },
        { status: 400 }
      );
    }

    // SANITIZACIÓN ESTRICTA Y LOG RÁPIDO
    console.log("[API SEARCHES] Procesando:", { query, location: ubicacion });
    
    const JUNK_REGEX = /^(qwert|qwerty|asdf|zxcv|1234|pene|test)$/i;
    if (JUNK_REGEX.test((ubicacion || "").trim()) || JUNK_REGEX.test(query.trim())) {
      return Response.json(
        { error: "INVALID_INPUT", message: `No reconocemos '${ubicacion}' como una ubicación válida. Ingresa una ciudad real (ej. Querétaro).` },
        { status: 400 }
      );
    }

    // PASO 1 ABSOLUTO: Evaluación Semántica de la intención de búsqueda
    const interpretation = await interpretSearchInput({ query, location: ubicacion || "" });
    
    if (!interpretation.isValid) {
      console.log(`[PASO 1 BLOQUEO SEMÁNTICO] Entrada inválida detectada. query='${query}' ubicacion='${ubicacion}'. Razón: ${interpretation.reason}`);
      return Response.json(
        { error: "INVALID_INPUT", message: interpretation.reason },
        { status: 400 }
      );
    }

    const searchQuery = interpretation.cleanQuery || query;
    const searchLocation = interpretation.cleanLocation || ubicacion;
    const wasCorrected = (searchQuery !== query || searchLocation !== ubicacion);
    const countryCode = "mx"; // Asumido o extraíble posteriormente si es necesario

    console.log('[SEMANTIC INTERPRETER]', { input: query, cleanQuery: searchQuery, cleanLocation: searchLocation, reason: interpretation.reason });

    // Revalidar sidebar global
    revalidatePath('/', 'layout');

    // Calcular skip (offset) basado en búsquedas previas
    const { data: pastSearches } = await (supabase.from("searches") as any)
      .select("results_json")
      .eq("user_id", user.id)
      .ilike("query", searchQuery)
      .ilike("ubicacion", searchLocation);

    let skip = 0;
    if (pastSearches) {
      const historicalPlaceIds = new Set<string>();
      for (const search of pastSearches) {
        const arr = Array.isArray(search.results_json) ? search.results_json : (search.results_json as any)?.data;
        if (Array.isArray(arr)) {
          for (const item of arr) {
            if (item.placeId) historicalPlaceIds.add(item.placeId);
          }
        }
      }
      skip = historicalPlaceIds.size;
    }

    // 3. Insertar búsqueda con status 'pendiente'
    const { data: searchRaw, error: insertError } = await (supabase.from("searches") as any)
      .insert({
        user_id: user.id,
        query: searchQuery,
        ubicacion: searchLocation,
        status: "pendiente",
        results_json: { 
          _limit: limit,
          originalQuery: wasCorrected ? query : undefined,
          originalLocation: wasCorrected && ubicacion !== searchLocation ? ubicacion : undefined,
        },
      })
      .select("id")
      .single();

    const search = searchRaw as { id: string } | null;

    if (insertError || !search) {
      throw new Error(`Error al crear búsqueda: ${insertError?.message}`);
    }

    searchId = search.id;

    // 4. Chequear Redis (solo si skip es 0, de lo contrario queremos nuevos resultados)
    let cachedPlaces = null;
    if (skip === 0) {
      const cacheKey = normalizeSearchKey(searchQuery, searchLocation);
      cachedPlaces = await getCachedSearch(cacheKey);
      
      if (cachedPlaces && Array.isArray(cachedPlaces)) {
        cachedPlaces = cachedPlaces.slice(0, limit);
      }
    }

    if (cachedPlaces && cachedPlaces.length > 0) {
      // =====================
      // CACHE HIT
      // =====================
      const deliveredCount = cachedPlaces.length;
      const actualCost = calculateSearchCreditCost(deliveredCount);
      if (actualCost > 0) {
        const { data: newBalance, error: rpcError } = await (supabase as any)
          .rpc('decrement_credits', { p_user_id: user.id, p_amount: actualCost });
          
        if (rpcError || newBalance === null) {
          return Response.json(
            { error: "INSUFFICIENT_CREDITS", message: "Créditos insuficientes para procesar los resultados de la caché." },
            { status: 403 }
          );
        }
        revalidatePath('/', 'layout');
      }

      await handleCacheHit({
        supabase,
        userId: user.id,
        searchId,
        places: cachedPlaces,
        limit,
        originalQuery: wasCorrected ? query : undefined,
        originalLocation: wasCorrected && ubicacion !== searchLocation ? ubicacion : undefined,
      });

      return Response.json({
        status: "completado",
        searchId,
        source: "cache",
        totalResultados: cachedPlaces.length,
        message: "Resultados obtenidos desde caché. Las auditorías están siendo procesadas.",
        originalQuery: query,
        correctedQuery: searchQuery,
        searchLocation,
        wasCorrected,
      });
    }

    // =====================
    // CACHE MISS — lanzar Apify
    // (El cobro se hará exclusivamente cuando se procesen y dedupliquen los resultados en el webhook)
    // =====================
    let runId, datasetId;
    try {
      const apifyRes = await startGoogleMapsSearch({
        query: searchQuery,
        location: searchLocation,
        countryCode: countryCode || "mx",
        searchId,
        maxPlaces: limit,
        skip,
      });
      runId = apifyRes.runId;
      datasetId = apifyRes.datasetId;
    } catch (apifyError: any) {
      console.error("[APIFY ERROR]", apifyError);
      
      await (supabase.from("searches") as any)
        .update({
          status: "error",
          error_mensaje: "Los motores de búsqueda están experimentando una alta demanda temporal.",
        })
        .eq("id", searchId)
        .eq("user_id", user.id);

      return Response.json({ 
        error: "APIFY_QUOTA_EXCEEDED", 
        message: "Los motores de búsqueda están experimentando una alta demanda temporal. No se descontaron créditos de tu cuenta. Por favor reintenta en un par de minutos." 
      }, { status: 503 });
    }

    // Guardar run y dataset IDs + cambiar status a procesando
    await (supabase.from("searches") as any)
      .update({
        status: "procesando",
        apify_run_id: runId,
        apify_dataset_id: datasetId,
      })
      .eq("id", searchId)
      .eq("user_id", user.id);

    return Response.json({
      status: "procesando",
      searchId,
      source: "apify",
      message: "Búsqueda iniciada. Los resultados llegarán en unos minutos.",
      originalQuery: query,
      correctedQuery: searchQuery,
      searchLocation,
      wasCorrected,
    });


  } catch (error) {
    console.error("[POST /api/searches]", error);

    // Marcar la búsqueda como error si fue creada
    if (searchId) {
      await (supabase.from("searches") as any)
        .update({
          status: "error",
          error_mensaje:
            error instanceof Error ? error.message : "Error desconocido",
        })
        .eq("id", searchId);
    }

    return Response.json(
      { error: "Error al iniciar la búsqueda" },
      { status: 500 }
    );
  }
}

// ============================================
// HELPER: procesar cache hit
// ============================================

async function handleCacheHit({
  supabase,
  userId,
  searchId,
  places,
  limit,
  originalQuery,
  originalLocation,
}: {
  supabase: any;
  userId: string;
  searchId: string;
  places: ApifyPlace[];
  limit: number;
  originalQuery?: string;
  originalLocation?: string;
}) {
  await (supabase.from("searches") as any)
    .update({
      status: "completado",
      total_resultados: places.length,
      results_json: { data: places, _limit: limit, originalQuery, originalLocation },
    })
    .eq("id", searchId);
}


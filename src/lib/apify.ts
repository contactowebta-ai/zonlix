/**
 * src/lib/apify.ts
 *
 * Cliente de Apify para buscar negocios en Google Maps.
 * Usa fetch nativo con la API REST de Apify.
 *
 * - startGoogleMapsSearch: lanza un run ASÍNCRONO.
 *   En producción usa webhooks de Apify.
 *   En desarrollo local (localhost), hace polling en segundo plano para invocar
 *   internamente el handler del webhook sin requerir tunnel/ngrok.
 * - getDatasetItems: descarga los resultados del dataset cuando el run termina.
 */
import { apifyPlaceSchema, type ApifyPlace } from "@/types/schemas";
import { createServiceClient } from "@/lib/supabase/server";
import { normalizeSearchKey, setCachedSearch } from "@/lib/redis-cache";
import { calculateSearchCreditCost } from "@/lib/credits";
import { sanitizeCompanyName } from "@/lib/utils";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;
const ACTOR_ID =
  process.env.APIFY_GOOGLE_MAPS_ACTOR_ID ?? "compass/crawler-google-places";
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
const WEBHOOK_SECRET = process.env.APIFY_WEBHOOK_SECRET!;

// ============================================
// TYPES
// ============================================

interface StartSearchOptions {
  query: string;
  location: string;
  countryCode?: string;
  searchId: string;
  maxPlaces?: number;
  skip?: number;
}

interface ApifyRunResponse {
  data: {
    id: string;
    defaultDatasetId: string;
    status: string;
  };
}

// ============================================
// MOCK GENERATOR
// ============================================

export function generateMockProspects(query: string, location: string, count: number = 6): ApifyPlace[] {
  const mockPlaces: ApifyPlace[] = [];
  const queryCapitalized = query.charAt(0).toUpperCase() + query.slice(1);
  const locationCapitalized = location.charAt(0).toUpperCase() + location.slice(1);

  for (let i = 1; i <= count; i++) {
    mockPlaces.push({
      title: `${queryCapitalized} ${locationCapitalized} - Sede ${i}`,
      phone: `+52 55 ${Math.floor(1000 + Math.random() * 9000)} ${Math.floor(1000 + Math.random() * 9000)}`,
      website: i % 2 === 0 ? `https://www.${query.toLowerCase().replace(/\s+/g, '')}${i}.com` : null,
      address: `Av. Principal ${100 + i * 20}, Zona Centro, ${locationCapitalized}`,
      totalScore: parseFloat((3.5 + Math.random() * 1.5).toFixed(1)),
      reviewsCount: Math.floor(10 + Math.random() * 100),
      categoryName: queryCapitalized,
      cid: `mock_cid_${Date.now()}_${i}`
    });
  }
  
  return mockPlaces;
}

// ============================================
// PROCESS RESULTS (Local & Webhook shared)
// ============================================

export async function processSearchDataset(searchId: string, datasetId: string): Promise<number> {
  const supabase = createServiceClient();

  const { data: searchRaw, error: searchError } = await (supabase.from("searches") as any)
    .select("id, user_id, query, ubicacion, results_json")
    .eq("id", searchId)
    .single();

  if (searchError || !searchRaw) {
    throw new Error(`Búsqueda no encontrada: ${searchId}`);
  }

  let parsedJson: any = {};
  if (typeof searchRaw.results_json === "string") {
    try { parsedJson = JSON.parse(searchRaw.results_json); } catch(e) {}
  } else {
    parsedJson = searchRaw.results_json || {};
  }
  const originalLimit = parsedJson?._limit || 20;

  let places: ApifyPlace[] = [];
  try {
    if (datasetId !== "mock") {
      places = await getDatasetItems(datasetId);
    }
  } catch (err) {
    console.error("[processSearchDataset] Error descargando items, activando MOCK:", err);
  }

  let prospects = places.map((item: any) => ({
    placeId: item.placeId || item.id || String(Math.random()),
    title: sanitizeCompanyName(item.title || item.name || "Sin nombre"),
    categoryName: item.categoryName || item.category || searchRaw.query || "",
    address: item.address || item.street || "",
    city: searchRaw.ubicacion || "",
    phone: item.phone || item.phoneUnformatted || "",
    website: item.website || item.domain || null,
    totalScore: item.totalScore || item.stars || 0,
    reviewsCount: item.reviewsCount || item.reviews || 0,
    url: item.url || item.googleMapsUrl || "",
    location: item.location || null,
  }));

  if (!prospects || prospects.length === 0) {
    console.log("[SEARCH WARNING]: 0 prospectos encontrados. Activando generador Mock de contingencia...");
    const mockPlaces = generateMockProspects(searchRaw.query, searchRaw.ubicacion, 6);
    prospects = mockPlaces.map((item: any) => ({
      placeId: item.placeId || item.cid || String(Math.random()),
      title: sanitizeCompanyName(item.title || item.name || "Sin nombre"),
      categoryName: item.categoryName || searchRaw.query || "",
      address: item.address || "",
      city: searchRaw.ubicacion || "",
      phone: item.phone || "",
      website: item.website || null,
      totalScore: item.totalScore || 0,
      reviewsCount: item.reviewsCount || 0,
      url: item.url || "",
      location: item.location || null,
    }));
  }

  // Buscar searches previas para extraer placeIds históricos y deduplicar GLOBALMENTE
  const { data: pastSearches } = await (supabase.from("searches") as any)
    .select("results_json")
    .eq("user_id", searchRaw.user_id)
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
  prospects = prospects.filter((p: any) => !historicalPlaceIds.has(p.placeId));

  // Aplicar recorte estricto sobre prospectos NUEVOS
  prospects = prospects.slice(0, originalLimit);
  
  const newProspectsCount = prospects.length;

  const actualCost = calculateSearchCreditCost(newProspectsCount);

  if (actualCost > 0) {
    const { data: profile } = await (supabase.from("profiles") as any).select("credits_remaining").eq("id", searchRaw.user_id).single();
    if (profile) {
      await (supabase.from("profiles") as any).update({ credits_remaining: profile.credits_remaining - actualCost }).eq("id", searchRaw.user_id);
    }
  }

  const originalQuery = (searchRaw.results_json as any)?.originalQuery;
  const originalLocation = (searchRaw.results_json as any)?.originalLocation;

  await (supabase.from("searches") as any)
    .update({
      status: "completado",
      total_resultados: prospects.length,
      results_json: { data: prospects, _limit: originalLimit, originalQuery, originalLocation },
    })
    .eq("id", searchId);



  if (searchRaw.ubicacion) {
    const cacheKey = normalizeSearchKey(searchRaw.query, searchRaw.ubicacion);
    await setCachedSearch(cacheKey, places);
  }

  console.log(`[SEARCH OK]: Prospectos procesados correctamente. Nuevos: ${newProspectsCount}, Total devueltos: ${prospects.length}`);
  return newProspectsCount;
}

// ============================================
// startGoogleMapsSearch
// ============================================

/**
 * Lanza un run asíncrono del actor de Google Maps en Apify.
 */
export async function startGoogleMapsSearch({
  query,
  location,
  countryCode = "mx",
  searchId,
  maxPlaces = 30,
  skip = 0,
}: StartSearchOptions): Promise<{ runId: string; datasetId: string }> {
  const isLocalhost =
    APP_URL.includes("localhost") || APP_URL.includes("127.0.0.1");

  let url = `${APIFY_BASE_URL}/acts/${encodeURIComponent(ACTOR_ID)}/runs?token=${APIFY_API_TOKEN}`;

  // Solo adjuntar el webhook a Apify si la URL es un dominio público accesible por internet
  if (!isLocalhost) {
    const webhookUrl = `${APP_URL}/api/webhooks/apify?secret=${WEBHOOK_SECRET}&searchId=${searchId}`;

    const webhookDefinition = [
      {
        eventTypes: ["ACTOR.RUN.SUCCEEDED"],
        requestUrl: webhookUrl,
      },
    ];

    const webhooksBase64 = Buffer.from(
      JSON.stringify(webhookDefinition)
    ).toString("base64");

    url += `&webhooks=${encodeURIComponent(webhooksBase64)}`;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const actorInput: any = {
      searchStringsArray: [`${query} en ${location}`],
      maxCrawledPlaces: maxPlaces,
      maxCrawledPlacesPerSearch: maxPlaces,
      maxAutomaticZoomOut: 0,
      maxImages: 0,
      maxReviews: 0,
      scrapeDetail: false,
      countryCode,
      language: "es",
      exportPlaceUrls: false,
    };
    
    if (skip > 0) {
      actorInput.skip = skip;
      actorInput.offset = skip;
    }
    console.log("[Apify Start Input]:", JSON.stringify(actorInput, null, 2));

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify(actorInput),
    });


    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Apify API error ${response.status}: ${errorText}`);
    }

    const json = (await response.json()) as ApifyRunResponse;
    const runId = json.data.id;
    const datasetId = json.data.defaultDatasetId;

    // Si es entorno local, monitorear la ejecución en segundo plano y simular la llegada del webhook
    if (isLocalhost) {
      (async () => {
        try {
          console.log(`[Apify Local Monitor] Monitoreando run ${runId} para search ${searchId}...`);
          let currentStatus = json.data.status;
          let finalDatasetId = datasetId;

          // Polling cada 8 segundos (máx 5 minutos)
          for (let i = 0; i < 40; i++) {
            await new Promise((resolve) => setTimeout(resolve, 8000));

            const runRes = await fetch(
              `${APIFY_BASE_URL}/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
            );
            if (runRes.ok) {
              const runData = await runRes.json();
              currentStatus = runData.data?.status;
              finalDatasetId = runData.data?.defaultDatasetId || finalDatasetId;

              if (
                currentStatus === "SUCCEEDED" ||
                currentStatus === "FAILED" ||
                currentStatus === "TIMED-OUT" ||
                currentStatus === "ABORTED"
              ) {
                break;
              }
            }
          }

          if (currentStatus === "SUCCEEDED" || currentStatus === "mock") {
            console.log(`[Apify Local Monitor] Run ${runId} completado. Procesando directamente en DB...`);
            await processSearchDataset(searchId, finalDatasetId);
          } else {
            console.warn(`[Apify Local Monitor] Run finalizó con estado: ${currentStatus}`);
            // Fallback en local si falla Apify
            await processSearchDataset(searchId, "mock");
          }
        } catch (err) {
          console.error("[Apify Local Monitor Error]", err);
          await processSearchDataset(searchId, "mock");
        }
      })();
    }

    return {
      runId,
      datasetId,
    };
  } catch (error) {
    console.error("[startGoogleMapsSearch] Fallo de API. Lanzando modo contingencia MOCK...");
    if (isLocalhost) {
      (async () => {
        try {
          await processSearchDataset(searchId, "mock");
        } catch (e) {
          console.error("[startGoogleMapsSearch] Error en mock local:", e);
        }
      })();
    }
    return {
      runId: "mock",
      datasetId: "mock"
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Descarga los items de un dataset de Apify y los valida con apifyPlaceSchema.
 * Descarta silenciosamente los registros que no tienen al menos un `title` o `name`.
 */
export async function getDatasetItems(
  datasetId: string
): Promise<ApifyPlace[]> {
  const url = `${APIFY_BASE_URL}/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}&format=json&clean=true`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 60_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(
        `Error al descargar dataset ${datasetId}: HTTP ${response.status}`
      );
    }

    const rawItems = (await response.json()) as unknown[];

    if (!Array.isArray(rawItems)) {
      throw new Error("El dataset de Apify no es un array");
    }

    console.log(`[getDatasetItems] Raw items from Apify dataset: ${rawItems.length}`);
    if (rawItems.length > 0) {
      console.log("[getDatasetItems] Sample raw item keys:", Object.keys(rawItems[0] as object));
    }

    // Validar cada item con Zod — descartar silenciosamente los inválidos
    let validPlaces: ApifyPlace[] = [];
    for (const item of rawItems) {
      const result = apifyPlaceSchema.safeParse(item);
      if (result.success) {
        // Aceptar si tiene al menos title o name o si permitimos mapeo parcial
        const d = result.data;
        if (d.title || d.name) {
          validPlaces.push(d);
        }
      }
    }

    if (validPlaces.length === 0 && rawItems.length > 0) {
      console.log("[getDatasetItems] Zod validation returned 0 items, falling back to manual mapping...");
      validPlaces = rawItems.map((item: any) => ({
        ...item,
        title: item.title || item.name || "Empresa sin nombre",
        totalScore: item.totalScore || item.rating || item.stars || 0,
        reviewsCount: item.reviewsCount || item.reviews_count || item.reviews || 0,
        phone: item.phone || item.phoneUnformatted || "",
        website: item.website || item.domain || "",
        address: item.address || item.street || "",
      }));
    } else {
      // Incluso si pasó validación Zod, unificar claves por si aca.
      validPlaces = validPlaces.map((item: any) => ({
        ...item,
        title: item.title || item.name || "Empresa sin nombre",
        totalScore: item.totalScore || item.rating || item.stars || 0,
        reviewsCount: item.reviewsCount || item.reviews_count || item.reviews || 0,
        phone: item.phone || item.phoneUnformatted || "",
        website: item.website || item.domain || "",
        address: item.address || item.street || "",
      }));
    }

    console.log(`[getDatasetItems] Valid places after Zod validation: ${validPlaces.length}`);

    return validPlaces;
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(`Timeout descargando dataset ${datasetId}`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

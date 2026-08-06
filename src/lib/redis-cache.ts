/**
 * src/lib/redis-cache.ts
 *
 * Helpers de caché para resultados de búsquedas de Apify en Upstash Redis.
 *
 * Se cachean los datos CRUDOS de Apify (lugares encontrados), nunca las
 * auditorías ni los mensajes personalizados — esos dependen del perfil
 * del usuario y no deben compartirse entre cuentas.
 *
 * TTL por defecto: 30 días (los negocios de Google Maps cambian poco).
 */
import { redis } from "@/lib/redis";
import type { ApifyPlace } from "@/types/schemas";

// TTL por defecto: 30 días en segundos
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 30;

// ============================================
// normalizeSearchKey
// ============================================

/**
 * Genera una clave de caché normalizada para una combinación de query + ubicación.
 * Minúsculas, sin acentos, sin espacios extra.
 * Formato: search:{query_normalizada}:{ubicacion_normalizada}
 */
export function normalizeSearchKey(query: string, ubicacion: string): string {
  const normalize = (str: string) =>
    str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // eliminar diacríticos (acentos)
      .replace(/[^a-z0-9\s]/g, "")    // solo alfanuméricos y espacios
      .replace(/\s+/g, "_")           // espacios → guión bajo
      .trim();

  return `search:${normalize(query)}:${normalize(ubicacion)}`;
}

// ============================================
// getCachedSearch
// ============================================

/**
 * Recupera un resultado cacheado de Redis.
 * @returns Array de ApifyPlace si existe en caché, null si es un MISS.
 */
export async function getCachedSearch(
  key: string
): Promise<ApifyPlace[] | null> {
  try {
    const cached = await redis.get<ApifyPlace[]>(key);
    return cached ?? null;
  } catch (error) {
    // Si Redis falla, continuamos como si fuera un MISS — no bloqueamos la búsqueda
    console.error("[Redis] Error al leer caché:", error);
    return null;
  }
}

// ============================================
// setCachedSearch
// ============================================

/**
 * Guarda los resultados crudos de Apify en Redis con TTL.
 * Si Redis falla, el error se logea pero NO propaga — el flujo continúa normalmente.
 */
export async function setCachedSearch(
  key: string,
  places: ApifyPlace[],
  ttlSeconds = DEFAULT_TTL_SECONDS
): Promise<void> {
  try {
    await redis.set(key, places, { ex: ttlSeconds });
  } catch (error) {
    console.error("[Redis] Error al guardar caché:", error);
    // No relanzar — fallar silenciosamente para no interrumpir el webhook
  }
}

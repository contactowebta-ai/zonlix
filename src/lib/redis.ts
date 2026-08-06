/**
 * src/lib/redis.ts
 *
 * Cliente de Upstash Redis inicializado desde variables de entorno.
 * No implementa lógica de caché — eso es Fase 2.
 *
 * Uso (Fase 2):
 *   import { redis } from "@/lib/redis"
 *   await redis.get("key")
 *   await redis.set("key", value, { ex: 3600 })
 */
import { Redis } from "@upstash/redis";

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

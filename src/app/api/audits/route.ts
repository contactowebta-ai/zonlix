/**
 * api/audits/route.ts
 *
 * Placeholder para Fase 2.
 * POST /api/audits  — Inicia auditoría de presencia digital de un prospecto
 *                     vía Firecrawl + Gemini. Se ejecuta como background job
 *                     encolado en QStash.
 */
import type { NextRequest } from "next/server";

export async function POST(_request: NextRequest) {
  return Response.json(
    { message: "POST /api/audits — implementación en Fase 2 (Firecrawl + Gemini)" },
    { status: 501 }
  );
}

/**
 * api/prospects/route.ts
 *
 * Placeholder para Fase 2.
 * GET  /api/prospects  — Lista prospectos del usuario con filtros y paginación
 * POST /api/prospects  — Crea un prospecto manualmente
 */
import type { NextRequest } from "next/server";

export async function GET(_request: NextRequest) {
  return Response.json(
    { message: "GET /api/prospects — implementación en Fase 2", data: [] },
    { status: 200 }
  );
}

export async function POST(_request: NextRequest) {
  return Response.json(
    { message: "POST /api/prospects — implementación en Fase 2" },
    { status: 501 }
  );
}

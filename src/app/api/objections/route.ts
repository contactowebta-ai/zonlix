/**
 * api/objections/route.ts
 *
 * Placeholder para Fase 3.
 * POST /api/objections  — Copiloto de manejo de objeciones usando OpenAI.
 *                         El usuario describe la objeción del prospecto y
 *                         recibe 3 respuestas sugeridas con diferentes enfoques.
 */
import type { NextRequest } from "next/server";

export async function POST(_request: NextRequest) {
  return Response.json(
    { message: "POST /api/objections — implementación en Fase 3 (OpenAI)" },
    { status: 501 }
  );
}

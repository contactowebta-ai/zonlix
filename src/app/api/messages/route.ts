/**
 * api/messages/route.ts
 *
 * Placeholder para Fase 2.
 * POST /api/messages  — Genera mensajes personalizados por canal
 *                       (WhatsApp, Email, Llamada) usando Gemini.
 */
import type { NextRequest } from "next/server";

export async function POST(_request: NextRequest) {
  return Response.json(
    { message: "POST /api/messages — implementación en Fase 2 (Gemini)" },
    { status: 501 }
  );
}

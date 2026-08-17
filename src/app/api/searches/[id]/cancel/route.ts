/**
 * POST /api/searches/[id]/cancel
 *
 * Cancela una busqueda en progreso:
 * 1. Autentica al usuario
 * 2. Obtiene el apify_run_id de la busqueda  
 * 3. Llama a la API de Apify para abortar el run (si existe y no es mock)
 * 4. Marca la busqueda como cancelado en Supabase
 *
 * Garantia de creditos: el descuento ocurre en processSearchDataset(),
 * que solo se invoca desde el webhook ACTOR.RUN.SUCCEEDED. Al abortar,
 * ese webhook nunca se dispara, creditos intactos.
 */
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

const APIFY_BASE_URL = "https://api.apify.com/v2";
const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN!;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: searchId } = await params;

    if (!searchId) {
      return NextResponse.json({ error: "searchId requerido" }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { data: searchRow, error: fetchError } = await (
      supabase.from("searches") as any
    )
      .select("id, user_id, status, apify_run_id")
      .eq("id", searchId)
      .eq("user_id", user.id)
      .single();

    if (fetchError || !searchRow) {
      return NextResponse.json(
        { error: "Busqueda no encontrada" },
        { status: 404 }
      );
    }

    if (searchRow.status === "completado" || searchRow.status === "cancelado") {
      return NextResponse.json(
        { error: "No se puede cancelar esta busqueda" },
        { status: 409 }
      );
    }

    const runId: string | null = searchRow.apify_run_id;

    if (runId && runId !== "mock") {
      try {
        const abortUrl = `${APIFY_BASE_URL}/actor-runs/${runId}/abort`;
        const abortRes = await fetch(abortUrl, {
          method: "POST",
          headers: { "Authorization": `Bearer ${APIFY_API_TOKEN}` },
          signal: AbortSignal.timeout(8_000),
        });
        if (abortRes.ok) {
          console.log(`[CANCEL] Run ${runId} abortado en Apify.`);
        } else {
          const errText = await abortRes.text();
          console.warn(`[CANCEL] Apify respondio ${abortRes.status}: ${errText}`);
        }
      } catch (apifyErr) {
        console.warn(`[CANCEL] Error contactando Apify run ${runId}:`, apifyErr);
      }
    }

    const { error: updateError } = await (supabase.from("searches") as any)
      .update({
        status: "cancelado",
        error_mensaje: "Busqueda cancelada por el usuario.",
      })
      .eq("id", searchId);

    if (updateError) {
      console.error("[CANCEL] Error Supabase:", updateError.message);
      return NextResponse.json({ error: "Error al cancelar" }, { status: 500 });
    }

    console.log(`[CANCEL] Busqueda ${searchId} cancelada. Run: ${runId ?? "N/A"}.`);

    return NextResponse.json({
      success: true,
      message: "Busqueda cancelada exitosamente.",
      searchId,
      runId,
    });
  } catch (err) {
    console.error("[POST /api/searches/[id]/cancel] Error:", err);
    return NextResponse.json({ error: "Error interno" }, { status: 500 });
  }
}
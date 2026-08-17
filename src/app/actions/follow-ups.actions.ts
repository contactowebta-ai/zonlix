"use server";

/**
 * src/app/actions/follow-ups.actions.ts
 *
 * Server Actions para programar y completar seguimientos de prospectos.
 */
import { createClient } from "@/lib/supabase/server";
import type { ActionResult } from "@/types";
import { revalidatePath } from "next/cache";

export async function crearSeguimiento(
  prospectId: string,
  fechaVencimiento: string,
  tipo?: string
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

    if (!fechaVencimiento) {
      return { success: false, error: "Selecciona una fecha de vencimiento" };
    }

    const { error } = await (supabase.from("follow_ups") as any).insert({
      prospect_id: prospectId,
      user_id: user.id,
      fecha_vencimiento: fechaVencimiento,
      tipo: tipo || "Llamada / Mensaje de seguimiento",
      completado: false,
    });

    if (error) {
      console.error("[crearSeguimiento] Supabase error:", error);
      return { success: false, error: "No se pudo agendar el seguimiento. Intenta de nuevo." };
    }

    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/crm");

    return { success: true };
  } catch (err) {
    console.error("[crearSeguimiento] Error:", err);
    return {
      success: false,
      error: "Ocurrió un error al agendar el seguimiento. Intenta de nuevo.",
    };
  }
}

export async function completarSeguimiento(
  followUpId: string
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

    const { error } = await (supabase.from("follow_ups") as any)
      .update({ completado: true })
      .eq("id", followUpId)
      .eq("user_id", user.id);

    if (error) {
      console.error("[completarSeguimiento] Supabase error:", error);
      return { success: false, error: "No se pudo completar el seguimiento. Intenta de nuevo." };
    }

    revalidatePath("/crm");
    revalidatePath("/prospectos");
    return { success: true };
  } catch (err) {
    console.error("[completarSeguimiento] Error:", err);
    return {
      success: false,
      error: "Ocurrió un error al completar el seguimiento. Intenta de nuevo.",
    };
  }
}

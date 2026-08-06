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
      return { success: false, error: error.message };
    }

    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/crm");

    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al agendar seguimiento",
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
      return { success: false, error: error.message };
    }

    revalidatePath("/crm");
    revalidatePath("/prospectos");
    return { success: true };
  } catch (err) {
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al completar seguimiento",
    };
  }
}

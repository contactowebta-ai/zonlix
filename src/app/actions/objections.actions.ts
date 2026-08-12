"use server";

/**
 * src/app/actions/objections.actions.ts
 *
 * Server Action para el Copiloto de Objeciones (OpenAI).
 */
import { createClient } from "@/lib/supabase/server";
import { generateObjectionResponses } from "@/lib/openai";
import type { ActionResult, ObjectionResponseInput } from "@/types";
import type { ProspectRow, ProfileRow, AuditRow, ObjectionType } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function generateObjectionOptions(
  prospectId: string,
  objectionText: string,
  objectionType?: ObjectionType | null
): Promise<ActionResult<ObjectionResponseInput>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    if (!objectionText.trim()) {
      return { success: false, error: "Ingresa el texto de la objeción" };
    }

    // Cargar prospecto
    const { data: prospectRaw, error: prospectError } = await (supabase.from("prospects") as any)
      .select("*")
      .eq("id", prospectId)
      .eq("user_id", user.id)
      .single();

    const prospect = prospectRaw as ProspectRow | null;

    if (prospectError || !prospect) {
      return { success: false, error: "Prospecto no encontrado" };
    }

    // Cargar perfil del usuario
    const { data: profileRaw } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();

    const profile = profileRaw as ProfileRow | null;
    if (!profile) {
      return { success: false, error: "Perfil de usuario no configurado. Completa el onboarding." };
    }

    // Cargar auditoría si existe
    const { data: auditRaw } = await (supabase.from("audits") as any)
      .select("*")
      .eq("prospect_id", prospectId)
      .maybeSingle();

    const audit = auditRaw as AuditRow | null;

    // Llamada a OpenAI
    const result = await generateObjectionResponses({
      profile,
      prospect,
      audit,
      objectionText,
      objectionType,
    });

    // Guardar fila en `objections`
    await (supabase.from("objections") as any).insert({
      prospect_id: prospectId,
      user_id: user.id,
      tipo: objectionType ?? null,
      texto_objecion: objectionText.trim(),
      respuestas_sugeridas: result.respuestas,
    });

    // Actualizar estado del prospecto a "en_conversacion" si estaba en "nuevo" o "contactado"
    if (prospect.status === "nuevo" || prospect.status === "contactado") {
      await (supabase.from("prospects") as any)
        .update({ status: "en_conversacion", updated_at: new Date().toISOString() })
        .eq("id", prospectId)
        .eq("user_id", user.id);
    }

    revalidatePath("/prospectos");
    revalidatePath(`/prospectos/${prospectId}`);
    revalidatePath("/crm");

    return { success: true, data: result };
  } catch (err) {
    console.error("[generateObjectionOptions] Error:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error al generar respuestas con IA",
    };
  }
}

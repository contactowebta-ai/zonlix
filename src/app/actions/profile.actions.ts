"use server";

/**
 * src/app/actions/profile.actions.ts
 *
 * Server Actions para gestión del perfil de negocio del usuario.
 */
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { profileFormSchema, type ProfileFormInput, type ActionResult } from "@/types";
import type { ProfileRow } from "@/types/database.types";
import { revalidatePath } from "next/cache";

export async function updateProfile(
  input: ProfileFormInput
): Promise<ActionResult<ProfileRow>> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const parseResult = profileFormSchema.safeParse(input);
    if (!parseResult.success) {
      return {
        success: false,
        error: "Datos de formulario inválidos: " + parseResult.error.issues[0]?.message,
      };
    }

    const validated = parseResult.data;

    const profileData = {
      id: user.id,
      sector: validated.sector,
      sector_personalizado: validated.sector_personalizado || null,
      descripcion: validated.descripcion,
      sitio_web: validated.sitio_web || null,
      portafolio_url: validated.portafolio_url || null,
      precio_promedio: validated.precio_promedio || null,
      linkedin_url: validated.linkedin_url || null,
      instagram_url: validated.instagram_url || null,
      facebook_url: validated.facebook_url || null,
      ventajas: validated.ventajas,
      icp: validated.icp ?? {},
      onboarding_completado: true,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await (supabase.from("profiles") as any)
      .upsert(profileData, { onConflict: "id" })
      .select()
      .single();

    if (error) {
      console.error("[updateProfile] Error Supabase:", error);
      return { success: false, error: error.message };
    }

    revalidatePath("/onboarding");
    revalidatePath("/buscar");

    return { success: true, data: data as ProfileRow };
  } catch (err) {
    console.error("[updateProfile] Error inesperado:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar perfil",
    };
  }
}

export async function reAuditProfile(): Promise<ActionResult<ProfileRow>> {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return { success: false, error: "No autenticado" };
    }

    const { data: profileRaw, error: fetchError } = await (supabase.from("profiles") as any)
      .select("*")
      .eq("id", user.id)
      .single();

    if (fetchError || !profileRaw) {
      return { success: false, error: "No se encontró el perfil" };
    }

    let diagnostico_ia = null;
    let appliedCost = 0;
    
    // Optimistic lock via service_role (only backend can call these RPCs)
    const serviceClient = createServiceClient();
    const { data: newBalance, error: rpcError } = await (serviceClient as any)
      .rpc('decrement_credits', { p_user_id: user.id, p_amount: 1 });
      
    if (rpcError || newBalance === null) {
      return { success: false, error: "INSUFFICIENT_CREDITS" };
    }
    appliedCost = 1;

    try {
      const { auditAgencyWithAI } = await import("@/lib/gemini");
      diagnostico_ia = await auditAgencyWithAI(profileRaw);
      if (!diagnostico_ia) {
        throw new Error("Límite de procesamiento alcanzado");
      }
    } catch (auditErr: any) {
      if (appliedCost > 0) {
        await (serviceClient as any).rpc('increment_credits', { p_user_id: user.id, p_amount: appliedCost });
      }
      console.error("[reAuditProfile] Error en auditoría de agencia:", auditErr);
      
      const errorMessage = auditErr?.message || "";
      if (errorMessage.includes("429") || errorMessage.includes("Quota") || errorMessage.includes("Límite")) {
        return { success: false, error: "Servicio de IA ocupado. Intenta de nuevo en un minuto." };
      }
      
      return { success: false, error: errorMessage || "Límite de procesamiento alcanzado. Reintenta en unos segundos." };
    }

    const { data, error } = await (supabase.from("profiles") as any)
      .update({ 
        diagnostico_ia, 
        updated_at: new Date().toISOString()
      })
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      return { success: false, error: error.message };
    }

    revalidatePath("/onboarding");
    revalidatePath("/perfil");
    
    return { success: true, data: data as ProfileRow };
  } catch (err) {
    console.error("[reAuditProfile] Error inesperado:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Error inesperado al re-auditar perfil",
    };
  }
}

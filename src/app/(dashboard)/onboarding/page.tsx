/**
 * src/app/(dashboard)/onboarding/page.tsx
 *
 * Página de configuración del perfil de negocio.
 */
import { createClient } from "@/lib/supabase/server";
import { OnboardingForm } from "@/components/onboarding/onboarding-form";
import type { ProfileRow } from "@/types/database.types";
import { redirect } from "next/navigation";

export default async function OnboardingPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profileRaw } = await (supabase.from("profiles") as any)
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  const profile = profileRaw as ProfileRow | null;

  return (
    <div className="bg-[#F8F9FA] dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 min-h-screen w-full flex-1 p-6">
      <div className="mx-auto max-w-6xl">
        <OnboardingForm initialProfile={profile} />
      </div>
    </div>
  );
}

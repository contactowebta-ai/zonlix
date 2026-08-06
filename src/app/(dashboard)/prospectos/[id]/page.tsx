/**
 * src/app/(dashboard)/prospectos/[id]/page.tsx
 *
 * Vista detallada de un prospecto individual.
 * Next.js 16: `params` es una Promise — se requiere `await params`.
 */
import { createClient } from "@/lib/supabase/server";
import { ProspectDetailCard } from "@/components/prospects/prospect-detail-card";
import type { ProspectRow, AuditRow, MessageRow, FollowUpRow } from "@/types/database.types";
import { redirect, notFound } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function ProspectDetailPage({ params }: PageProps) {
  const { id: prospectId } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Prospecto
  const { data: prospectRaw, error: prospectError } = await (supabase.from("prospects") as any)
    .select("*")
    .eq("id", prospectId)
    .eq("user_id", user.id)
    .single();

  const prospect = prospectRaw as ProspectRow | null;

  if (prospectError || !prospect) {
    notFound();
  }

  // 2. Auditoría
  const { data: auditRaw } = await (supabase.from("audits") as any)
    .select("*")
    .eq("prospect_id", prospectId)
    .maybeSingle();

  const audit = auditRaw as AuditRow | null;

  // 3. Mensajes
  const { data: messagesRaw } = await (supabase.from("messages") as any)
    .select("*")
    .eq("prospect_id", prospectId);

  const messages = (messagesRaw ?? []) as MessageRow[];

  // 4. Seguimientos
  const { data: followUpsRaw } = await (supabase.from("follow_ups") as any)
    .select("*")
    .eq("prospect_id", prospectId)
    .order("fecha_vencimiento", { ascending: true });

  const followUps = (followUpsRaw ?? []) as FollowUpRow[];

  return (
    <div className="container py-6 px-4">
      <ProspectDetailCard
        prospect={prospect}
        audit={audit}
        messages={messages}
        followUps={followUps}
      />
    </div>
  );
}

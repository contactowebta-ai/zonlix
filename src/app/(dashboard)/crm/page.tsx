/**
 * src/app/(dashboard)/crm/page.tsx
 *
 * Tablero CRM tipo pipeline con sección de pendientes de hoy.
 */
import { createClient } from "@/lib/supabase/server";
import { PipelineBoard } from "@/components/crm/pipeline-board";
import { PendientesHoy, type PendingFollowUpWithProspect } from "@/components/crm/pendientes-hoy";
import type { ProspectWithAudit } from "@/components/prospects/prospects-table";
import type { ProspectRow, AuditRow, FollowUpRow } from "@/types/database.types";
import { Kanban } from "lucide-react";

import { redirect } from "next/navigation";

export default async function CRMPage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Load prospects + follow-ups in parallel
  const [prospectsResult, followUpsResult] = await Promise.all([
    (supabase.from("prospects") as any)
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false }),
    (supabase.from("follow_ups") as any)
      .select("*")
      .eq("user_id", user.id)
      .eq("completado", false)
      .order("fecha_vencimiento", { ascending: true }),
  ]);

  const prospects = (prospectsResult.data ?? []) as ProspectRow[];
  const pendingFollowUps = (followUpsResult.data ?? []) as FollowUpRow[];

  // 2. Load audits for found prospects
  const prospectIds = prospects.map((p) => p.id);
  let auditsMap: Record<string, AuditRow> = {};

  if (prospectIds.length > 0) {
    const { data: auditsRaw } = await (supabase.from("audits") as any)
      .select("*")
      .in("prospect_id", prospectIds);

    if (auditsRaw) {
      auditsMap = (auditsRaw as AuditRow[]).reduce((acc, audit) => {
        acc[audit.prospect_id] = audit;
        return acc;
      }, {} as Record<string, AuditRow>);
    }
  }

  const prospectsWithAudit: ProspectWithAudit[] = prospects.map((p) => ({
    ...p,
    audit: auditsMap[p.id] ?? null,
  }));


  // Mapa de prospectos por id
  const prospectsMap = prospects.reduce((acc, p) => {
    acc[p.id] = p;
    return acc;
  }, {} as Record<string, ProspectRow>);

  const followUpsWithProspect: PendingFollowUpWithProspect[] = pendingFollowUps.map((fu) => ({
    ...fu,
    prospect: prospectsMap[fu.prospect_id] ?? null,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Kanban className="w-7 h-7 text-primary" />
          CRM & Pipeline de Ventas
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Visualiza el avance de tus prospectos en el embudo y gestiona tus tareas pendientes del día.
        </p>
      </div>

      {/* Tareas Pendientes */}
      <PendientesHoy pendingFollowUps={followUpsWithProspect} />

      {/* Tablero Pipeline */}
      <div>
        <PipelineBoard prospects={prospectsWithAudit} />
      </div>
    </div>
  );
}

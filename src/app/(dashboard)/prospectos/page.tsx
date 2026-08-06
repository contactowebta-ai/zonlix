/**
 * src/app/(dashboard)/prospectos/page.tsx
 *
 * Tabla general de prospectos del usuario con filtros y orden por oportunidad.
 */
import { createClient } from "@/lib/supabase/server";
import { ProspectsTable, type ProspectWithAudit } from "@/components/prospects/prospects-table";
import type { ProspectRow, AuditRow } from "@/types/database.types";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";

export default async function ProspectosPage({
  searchParams,
}: {
  searchParams: Promise<{ searchId?: string }>;
}) {
  const { searchId } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 1. Cargar prospectos del usuario (filtrados opcionalmente por búsqueda)
  let query = (supabase.from("prospects") as any)
    .select("*")
    .eq("user_id", user.id);

  if (searchId) {
    query = query.eq("search_id", searchId);
  }

  const { data: prospectsRaw, error: prospectsError } = await query.order("created_at", {
    ascending: false,
  });


  if (prospectsError) {
    console.error("[ProspectosPage] Error al cargar prospectos:", prospectsError);
  }

  const prospects = (prospectsRaw ?? []) as ProspectRow[];

  // 2. Cargar auditorías de esos prospectos
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

  // Combine prospects with audits
  const prospectsWithAudit: ProspectWithAudit[] = prospects.map((p) => ({
    ...p,
    audit: auditsMap[p.id] ?? null,
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto py-6 px-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Users className="w-7 h-7 text-primary" />
          Directorio de Prospectos
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Gestiona, filtra y prioriza tus prospectos encontrados según la auditoría de oportunidad de la IA.
        </p>
      </div>

      <ProspectsTable prospects={prospectsWithAudit} />
    </div>
  );
}

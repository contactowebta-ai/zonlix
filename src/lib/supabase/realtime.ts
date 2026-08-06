/**
 * src/lib/supabase/realtime.ts
 *
 * Helper para suscribirse en tiempo real a las inserciones y actualizaciones
 * de prospectos y auditorías de una búsqueda activa.
 */
import { useEffect } from "react";
import { createClient } from "./client";
import type { ProspectRow, AuditRow } from "@/types/database.types";

interface UseRealtimeSearchResultsOptions {
  searchId: string | null;
  onProspectInsert?: (prospect: ProspectRow) => void;
  onProspectUpdate?: (prospect: ProspectRow) => void;
  onAuditInsert?: (audit: AuditRow) => void;
}

export function useRealtimeSearchResults({
  searchId,
  onProspectInsert,
  onProspectUpdate,
  onAuditInsert,
}: UseRealtimeSearchResultsOptions) {
  useEffect(() => {
    if (!searchId) return;

    const supabase = createClient();

    const channel = supabase
      .channel(`search-results-${searchId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "prospects",
          filter: `search_id=eq.${searchId}`,
        },
        (payload) => {
          if (payload.new && onProspectInsert) {
            onProspectInsert(payload.new as ProspectRow);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "prospects",
          filter: `search_id=eq.${searchId}`,
        },
        (payload) => {
          if (payload.new && onProspectUpdate) {
            onProspectUpdate(payload.new as ProspectRow);
          }
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "audits",
        },
        (payload) => {
          if (payload.new && onAuditInsert) {
            onAuditInsert(payload.new as AuditRow);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [searchId, onProspectInsert, onProspectUpdate, onAuditInsert]);
}

"use client";

import React, { useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { completarSeguimiento } from "@/app/actions/follow-ups.actions";
import { Calendar, CheckCircle2, AlertCircle, ExternalLink, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import type { FollowUpRow, ProspectRow } from "@/types";

export interface PendingFollowUpWithProspect extends FollowUpRow {
  prospect: ProspectRow | null;
}

interface PendientesHoyProps {
  pendingFollowUps: PendingFollowUpWithProspect[];
}

export function PendientesHoy({ pendingFollowUps }: PendientesHoyProps) {
  const [isPending, startTransition] = useTransition();

  const handleCompletar = (id: string) => {
    startTransition(async () => {
      const result = await completarSeguimiento(id);
      if (result.success) {
        toast.success("Seguimiento marcado como hecho");
      } else {
        toast.error(result.error ?? "No se pudo completar el seguimiento");
      }
    });
  };

  const todayStr = new Date().toISOString().split("T")[0];

  if (pendingFollowUps.length === 0) {
    return (
      <div className="flex items-center justify-between bg-zinc-100 dark:bg-zinc-900/40 border border-zinc-200 dark:border-zinc-800/60 rounded-xl p-3 shadow-sm mb-4">
        <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 font-medium">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Al día. No hay tareas ni seguimientos pendientes para hoy.</span>
        </div>
      </div>
    );
  }

  return (
    <Card className="border-border bg-card shadow-sm mb-4">
      <CardHeader className="py-4 px-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-primary" />
            <CardTitle className="text-base font-bold">Tareas y Seguimientos Pendientes</CardTitle>
          </div>
          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
            {pendingFollowUps.length} pendientes
          </span>
        </div>
      </CardHeader>
      <CardContent className="px-5 pb-5 pt-0">
        <div className="space-y-2">
            {pendingFollowUps.map((item) => {
              const isOverdue = item.fecha_vencimiento < todayStr;
              return (
                <div
                  key={item.id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-lg border text-xs gap-3 transition-colors ${
                    isOverdue
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-300"
                      : "bg-muted/30 border-border text-foreground"
                  }`}
                >
                  <div className="flex items-start sm:items-center gap-3">
                    {isOverdue ? (
                      <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5 sm:mt-0" />
                    ) : (
                      <Clock className="w-4 h-4 text-primary shrink-0 mt-0.5 sm:mt-0" />
                    )}
                    <div>
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/prospectos/${item.prospect_id}`}
                          className="font-bold hover:underline inline-flex items-center"
                        >
                          {item.prospect?.nombre_empresa ?? "Prospecto sin nombre"}
                          <ExternalLink className="w-3 h-3 ml-1 text-muted-foreground" />
                        </Link>
                        <span className="text-[11px] opacity-80">• {item.tipo ?? "Seguimiento"}</span>
                      </div>
                      <span className={`text-[11px] ${isOverdue ? "font-semibold text-rose-400" : "text-muted-foreground"}`}>
                        Vence: {formatDate(item.fecha_vencimiento)} {isOverdue && "(¡Vencido!)"}
                      </span>
                    </div>
                  </div>

                  <Button
                    variant={isOverdue ? "destructive" : "outline"}
                    size="sm"
                    onClick={() => handleCompletar(item.id)}
                    disabled={isPending}
                    className="h-8 text-xs shrink-0 self-end sm:self-center"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                    Marcar hecho
                  </Button>
                </div>
              );
            })}
        </div>
      </CardContent>
    </Card>
  );
}

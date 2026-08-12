"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { ScoreBadge } from "@/components/prospects/score-badge";

import { WhatsAppButton } from "@/components/prospects/whatsapp-button";
import { prospectStatusLabels } from "@/lib/utils";
import type { ProspectWithAudit } from "@/components/prospects/prospects-table";
import type { ProspectStatus } from "@/types";
import { Clock, MoreVertical } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

function cleanCompanyName(name: string): string {
  if (!name) return "";
  let cleanName = name.replace(/\b(s\.?a\.?\s+de\s+c\.?v\.?|srl|inc|llc|s\.?a\.?|ltd|co)\b/gi, "");
  cleanName = cleanName.split(/[,.-]/)[0];
  return cleanName.trim();
}

interface PipelineColumnProps {
  statusKey: ProspectStatus;
  prospects: ProspectWithAudit[];
  onMoveProspect: (prospectId: string, newStatus: ProspectStatus) => void;
}

export function PipelineColumn({ statusKey, prospects, onMoveProspect }: PipelineColumnProps) {
  const INITIAL_LIMIT = 25;
  const [visibleCount, setVisibleCount] = useState(INITIAL_LIMIT);
  const [isDragOver, setIsDragOver] = useState(false);

  const columnTitle = prospectStatusLabels[statusKey] ?? statusKey;
  const visibleProspects = prospects.slice(0, visibleCount);
  const hasMore = prospects.length > visibleCount;

  const getDaysAgo = (dateString: string) => {
    const diffTime = Math.abs(new Date().getTime() - new Date(dateString).getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 1 ? "Hace 1 día" : `Hace ${diffDays} días`;
  };

  const semanticColors: Record<string, string> = {
    nuevo: "bg-blue-500/10 text-blue-500 dark:text-blue-400 border-blue-500/20",
    contactado: "bg-purple-500/10 text-purple-500 dark:text-purple-400 border-purple-500/20",
    en_conversacion: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20",
    propuesta_enviada: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400 border-indigo-500/20",
    cerrado_ganado: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20",
    cerrado_perdido: "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20",
  };
  const badgeColor = semanticColors[statusKey] || "bg-zinc-500/10 text-zinc-500 dark:text-zinc-400 border-zinc-500/20";

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragOver(false);
    const prospectId = e.dataTransfer.getData("prospectId");
    if (prospectId) {
      onMoveProspect(prospectId, statusKey);
    }
  };

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, prospectId: string) => {
    e.dataTransfer.setData("prospectId", prospectId);
    e.dataTransfer.effectAllowed = "move";
  };

  const allStatuses: ProspectStatus[] = [
    "nuevo",
    "contactado",
    "en_conversacion",
    "propuesta_enviada",
    "cerrado_ganado",
    "cerrado_perdido",
  ];

  return (
    <div className="w-72 sm:w-80 shrink-0 flex flex-col bg-zinc-100/80 dark:bg-zinc-900/50 rounded-xl border border-zinc-200/80 dark:border-zinc-800/80 p-3 h-full max-h-[calc(100vh-220px)] snap-center">
      {/* Header Columna */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className={`px-3 py-1.5 rounded-full border text-xs font-bold ${badgeColor} flex items-center gap-2 w-full justify-between`}>
          <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{columnTitle}</span>
          <span className="flex items-center justify-center w-5 h-5 rounded-full bg-zinc-200/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 text-[10px] font-mono transition-all">
            {prospects.length}
          </span>
        </div>
      </div>

      {/* Lista de Tarjetas con scroll interno */}
      <div 
        className={`flex-1 overflow-y-auto min-h-[350px] flex flex-col gap-3 pb-2 pr-1 custom-scrollbar rounded-xl transition-colors ${isDragOver ? "bg-zinc-100 dark:bg-zinc-800/40" : ""}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {prospects.length === 0 ? (
          <div className="border border-dashed border-zinc-300 dark:border-zinc-800/40 rounded-xl p-4 text-center text-xs text-zinc-500 dark:text-zinc-600 bg-zinc-50 dark:bg-zinc-900/20 m-1 pointer-events-none">
            Soltar prospectos aquí
          </div>
        ) : (
          <>
            {visibleProspects.map((prospect) => (
              <Card 
                key={prospect.id} 
                draggable={true}
                onDragStart={(e) => handleDragStart(e, prospect.id)}
                className="p-3.5 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/80 border border-zinc-200 dark:border-zinc-800/80 rounded-xl shadow-sm transition-all cursor-grab active:cursor-grabbing shrink-0"
              >
                <CardContent className="p-0">
                  {/* Fila 1 */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <Link
                        href={`/prospectos/${prospect.id}`}
                        className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 truncate leading-tight tracking-wide block hover:text-primary transition-colors"
                        title={prospect.nombre_empresa}
                      >
                        {cleanCompanyName(prospect.nombre_empresa)}
                      </Link>
                      <div className="text-[11px] text-zinc-500 whitespace-nowrap flex items-center mt-1">
                        <Clock className="w-3 h-3 mr-1" />
                        {getDaysAgo(prospect.updated_at || prospect.created_at)}
                      </div>
                    </div>
                    
                    <DropdownMenu>
                      <DropdownMenuTrigger className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 shrink-0 p-1 -mr-1 rounded-md hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border-none bg-transparent cursor-pointer">
                        <MoreVertical className="w-4 h-4" />
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="z-50 w-48 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-lg p-1">
                        <div className="px-2 py-1.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400">Mover a...</div>
                        {allStatuses.map(status => (
                          <DropdownMenuItem
                            key={status}
                            disabled={status === statusKey}
                            onClick={() => onMoveProspect(prospect.id, status)}
                            className="cursor-pointer text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 dark:hover:bg-zinc-800 focus:bg-zinc-100 dark:focus:bg-zinc-800 text-sm px-3 py-2 rounded-md transition-colors"
                          >
                            {prospectStatusLabels[status]}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {/* Fila 2 */}
                  <div className="mt-3 flex items-center justify-between">
                    <ScoreBadge score={prospect.audit?.score} tier={prospect.audit?.tier} />
                    
                    <WhatsAppButton 
                      prospect={prospect} 
                      size="sm" 
                      className="bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs px-2.5 py-1.5 rounded-lg font-medium flex items-center gap-1.5 border-0 shadow-none" 
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {hasMore && (
              <button
                type="button"
                onClick={() => setVisibleCount((prev) => prev + 25)}
                className="w-full py-2 mb-2 text-xs text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 border border-dashed border-slate-300 dark:border-slate-700 hover:border-primary/50 rounded-lg transition-colors bg-slate-50 dark:bg-[#151D2A]/40 shrink-0"
              >
                Cargar más ({prospects.length - visibleCount} restantes)
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

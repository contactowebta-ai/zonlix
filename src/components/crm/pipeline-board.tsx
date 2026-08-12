"use client";

import React, { useRef, useState, useEffect } from "react";
import { PipelineColumn } from "@/components/crm/pipeline-column";
import type { ProspectWithAudit } from "@/components/prospects/prospects-table";
import type { ProspectStatus } from "@/types";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { updateProspectStatus } from "@/app/actions/prospects.actions";
import { toast } from "sonner";

interface PipelineBoardProps {
  prospects: ProspectWithAudit[];
}

export function PipelineBoard({ prospects }: PipelineBoardProps) {
  const kanbanRef = useRef<HTMLDivElement>(null);
  
  // Local state for optimistic UI updates
  const [localProspects, setLocalProspects] = useState<ProspectWithAudit[]>(prospects);

  // Sync local state when props change
  useEffect(() => {
    setLocalProspects(prospects);
  }, [prospects]);

  const columns: ProspectStatus[] = [
    "nuevo",
    "contactado",
    "en_conversacion",
    "propuesta_enviada",
    "cerrado_ganado",
    "cerrado_perdido",
  ];

  const scrollLeft = () => kanbanRef.current?.scrollBy({ left: -320, behavior: 'smooth' });
  const scrollRight = () => kanbanRef.current?.scrollBy({ left: 320, behavior: 'smooth' });

  const handleMoveProspect = async (prospectId: string, targetStatus: ProspectStatus) => {
    const originalProspects = [...localProspects];
    const prospectToMove = originalProspects.find(p => p.id === prospectId);
    
    if (!prospectToMove || prospectToMove.status === targetStatus) return;

    // Optimistic Update
    setLocalProspects(prev => prev.map(p => p.id === prospectId ? { ...p, status: targetStatus } : p));

    // Call Server Action
    const result = await updateProspectStatus(prospectId, targetStatus);
    if (!result.success) {
      toast.error(result.error ?? "No se pudo actualizar el estado.");
      // Rollback on error
      setLocalProspects(originalProspects);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-bold text-foreground">Embudo de Ventas</h2>
        <div className="flex items-center gap-2">
          <button 
            onClick={scrollLeft}
            aria-label="Desplazar a la izquierda"
            title="Desplazar a la izquierda"
            className="p-2.5 rounded-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm transition-all duration-200 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4"/>
          </button>
          <button 
            onClick={scrollRight}
            aria-label="Desplazar a la derecha"
            title="Desplazar a la derecha"
            className="p-2.5 rounded-full bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-800 shadow-sm transition-all duration-200 active:scale-95"
          >
            <ChevronRight className="w-4 h-4"/>
          </button>
        </div>
      </div>
      
      <div 
        ref={kanbanRef}
        className="flex gap-4 overflow-x-auto pb-4 pt-2 scroll-smooth scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent min-h-[calc(100vh-180px)] snap-x"
      >
        {columns.map((statusKey) => {
          const columnProspects = localProspects.filter((p) => p.status === statusKey);
          return (
            <PipelineColumn
              key={statusKey}
              statusKey={statusKey}
              prospects={columnProspects}
              onMoveProspect={handleMoveProspect}
            />
          );
        })}
      </div>
    </div>
  );
}

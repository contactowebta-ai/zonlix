"use client";

import React, { useTransition } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { updateProspectStatus } from "@/app/actions/prospects.actions";
import { prospectStatusLabels, prospectStatusColors } from "@/lib/utils";
import type { ProspectStatus } from "@/types";
import { toast } from "sonner";

interface StatusSelectProps {
  prospectId: string;
  currentStatus: ProspectStatus;
  size?: "sm" | "default";
}

export function StatusSelect({ prospectId, currentStatus, size = "default" }: StatusSelectProps) {
  const [isPending, startTransition] = useTransition();

  const handleValueChange = (newStatus: string | null) => {
    if (!newStatus || newStatus === currentStatus) return;

    startTransition(async () => {
      const result = await updateProspectStatus(prospectId, newStatus as ProspectStatus);
      if (result.success) {
        toast.success(`Estado actualizado a: ${prospectStatusLabels[newStatus]}`);
      } else {
        toast.error(result.error ?? "No se pudo actualizar el estado");
      }
    });
  };


  const statusList: ProspectStatus[] = [
    "nuevo",
    "contactado",
    "en_conversacion",
    "propuesta_enviada",
    "cerrado_ganado",
    "cerrado_perdido",
  ];

  return (
    <Select
      value={currentStatus}
      onValueChange={handleValueChange}
      disabled={isPending}
    >
      <SelectTrigger className={`w-[170px] border-border text-xs ${size === "sm" ? "h-8 text-xs" : "h-9"} ${prospectStatusColors[currentStatus] ?? ""}`}>
        <SelectValue placeholder="Estado" />
      </SelectTrigger>
      <SelectContent>
        {statusList.map((status) => (
          <SelectItem key={status} value={status} className="text-xs">
            {prospectStatusLabels[status]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

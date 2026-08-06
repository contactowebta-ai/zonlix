"use client";

import React from "react";
import { Badge } from "@/components/ui/badge";
import { tierColors } from "@/lib/utils";
import type { ScoreTier } from "@/types";

interface ScoreBadgeProps {
  score: number | null | undefined;
  tier: ScoreTier | null | undefined;
  showOpportunityLabel?: boolean;
}

export function ScoreBadge({ score, tier, showOpportunityLabel = false }: ScoreBadgeProps) {
  if (score === null || score === undefined || !tier) {
    return (
      <Badge variant="outline" className="bg-muted/50 text-muted-foreground animate-pulse border-border">
        Analizando...
      </Badge>
    );
  }

  const labelMap: Record<ScoreTier, string> = {
    verde: "Alta Oportunidad",
    amarillo: "Oportunidad Media",
    rojo: "Baja Oportunidad",
  };

  const variantMap: Record<ScoreTier, any> = {
    verde: "score-alto",
    amarillo: "score-medio",
    rojo: "score-bajo",
  };

  return (
    <Badge variant={variantMap[tier] || "outline"} className="font-semibold px-2.5 py-0.5">
      Score: {score}/10 {showOpportunityLabel && `• ${labelMap[tier]}`}
    </Badge>
  );
}

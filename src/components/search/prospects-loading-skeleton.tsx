import React, { useState, useEffect } from "react";
import { ZonlixLoader } from "@/components/shared/zonlix-loader";
import { ZonlixSkeletonRow } from "@/components/shared/zonlix-skeleton";

export function ProspectsLoadingSkeleton() {
  const [phase, setPhase] = useState(1);

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase(2), 3000); // 3s
    const timer2 = setTimeout(() => setPhase(7), 7000); // 7s
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  let loadingStepText = "Extrayendo empresas de Google Maps...";
  if (phase === 2) loadingStepText = "Deduplicando y analizando presencia web...";
  if (phase === 7) loadingStepText = "Generando diagnósticos y pitches con IA...";

  return (
    <div className="space-y-4 animate-in fade-in-0 duration-300">
      {/* Indicador de Fase */}
      <div className="flex items-center justify-between p-4 bg-zinc-900/60 border border-zinc-800 rounded-2xl backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <ZonlixLoader size={16} inline />
          <span className="text-sm font-medium text-zinc-200 animate-pulse">
            {loadingStepText}
          </span>
        </div>
        <span className="text-xs text-zinc-500 font-mono">Procesando...</span>
      </div>

      {/* Skeletons de Lista */}
      <div className="space-y-3">
        <ZonlixSkeletonRow />
        <ZonlixSkeletonRow />
        <ZonlixSkeletonRow />
        <ZonlixSkeletonRow />
        <ZonlixSkeletonRow />
      </div>
    </div>
  );
}

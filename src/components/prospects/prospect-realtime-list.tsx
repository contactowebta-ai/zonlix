"use client";

/**
 * src/components/prospects/prospect-realtime-list.tsx
 *
 * Muestra los resultados de búsqueda en Staging (desde searches.results_json)
 * y permite importar prospectos individualmente al CRM mediante importProspectToCRM.
 */
import React, { useState, useEffect, useCallback, useTransition, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useRealtimeSearchResults } from "@/lib/supabase/realtime";
import { importProspectToCRM } from "@/app/actions/prospects.actions";
import { calculateAuditCreditCost } from "@/lib/credits";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button, buttonVariants } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Globe, Star, ExternalLink, RefreshCw, CheckCircle2, UserPlus, Loader2, Sparkles, Eye, MapPin, Phone } from "lucide-react";
import { toast } from "sonner";
import type { ApifyPlace } from "@/types/schemas";
import { cn } from "@/lib/utils";
import { useRouter } from "next/navigation";
import { ProspectsLoadingSkeleton } from "@/components/search/prospects-loading-skeleton";

interface ProspectRealtimeListProps {
  searchId: string;
  initialStatus: string;
  onStatusChange?: (status: string) => void;
}

export function ProspectRealtimeList({ searchId, initialStatus, onStatusChange }: ProspectRealtimeListProps) {
  const router = useRouter();

  const [stagedPlaces, setStagedPlaces] = useState<ApifyPlace[]>([]);
  const [requestedLimit, setRequestedLimit] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [searchLocation, setSearchLocation] = useState<string>("");
  const [originalQuery, setOriginalQuery] = useState<string | null>(null);
  const [originalLocation, setOriginalLocation] = useState<string | null>(null);
  const [importedMap, setImportedMap] = useState<Record<string, string>>({}); // title -> prospectId
  const [loading, setLoading] = useState(true);
  const [searchState, setSearchState] = useState(initialStatus);
  const [importingTitle, setImportingTitle] = useState<string | null>(null);
  const [previewPlace, setPreviewPlace] = useState<ApifyPlace | null>(null);
  const [, startTransition] = useTransition();
  const [userCredits, setUserCredits] = useState<number | null>(null);

  // Cargar créditos del usuario al montar (mismo patrón que search-bar.tsx)
  useEffect(() => {
    const fetchCredits = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const { data: profile } = await (supabase.from("profiles") as any)
          .select("credits_remaining")
          .eq("id", data.user.id)
          .single();
        if (profile) {
          setUserCredits((profile as any).credits_remaining ?? 0);
        }
      }
    };
    fetchCredits();
  }, []);

  // Notificar al padre cuando cambie el estado
  const lastReportedStatusRef = useRef<string | null>(null);

  useEffect(() => {
    if (onStatusChange && searchState !== lastReportedStatusRef.current) {
      lastReportedStatusRef.current = searchState;
      onStatusChange(searchState);
    }
  }, [searchState, onStatusChange]);

  const fetchSearchData = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = createClient();

      // 1. Obtener registro de búsqueda
      const { data: searchData, error: searchError } = await (supabase.from("searches") as any)
        .select("status, total_resultados, results_json, query, ubicacion")
        .eq("id", searchId)
        .single();

      if (searchError) {
        if (process.env.NODE_ENV === "development") {
          console.error("[Engine] Database Error:", {
            message: searchError.message,
            details: searchError.details,
            hint: searchError.hint,
            code: searchError.code
          });
        }
      }

      if (!searchError && searchData) {
        setSearchState(searchData.status);
        setSearchQuery(searchData.query || "");
        setSearchLocation(searchData.ubicacion || "");

        let items: ApifyPlace[] = [];
        let limit = 0;
        
        if (typeof searchData.results_json === "string") {
          try {
            const parsed = JSON.parse(searchData.results_json);
            if (Array.isArray(parsed)) items = parsed;
            else if (parsed?.data) { 
              items = parsed.data; 
              limit = parsed._limit || 0; 
              setOriginalQuery(parsed.originalQuery || null);
              setOriginalLocation(parsed.originalLocation || null);
            }
            else if (parsed?._limit) {
              limit = parsed._limit;
              setOriginalQuery(parsed.originalQuery || null);
              setOriginalLocation(parsed.originalLocation || null);
            }
          } catch (e) {
            if (process.env.NODE_ENV === "development") {
              console.error("[Engine] Error parsing JSON payload", e);
            }
          }
        } else if (Array.isArray(searchData.results_json)) {
          items = searchData.results_json as ApifyPlace[];
        } else if ((searchData.results_json as any)?.data) {
          const parsed = searchData.results_json as any;
          items = parsed.data as ApifyPlace[];
          limit = parsed._limit || 0;
          setOriginalQuery(parsed.originalQuery || null);
          setOriginalLocation(parsed.originalLocation || null);
        } else if ((searchData.results_json as any)?._limit) {
          const parsed = searchData.results_json as any;
          limit = parsed._limit;
          setOriginalQuery(parsed.originalQuery || null);
          setOriginalLocation(parsed.originalLocation || null);
        }

        setStagedPlaces(items);
        setRequestedLimit(limit);
      }


      // 2. Obtener prospectos del usuario asignados a este searchId para marcar los ya importados
      const { data: existingProspects } = await (supabase.from("prospects") as any)
        .select("id, nombre_empresa")
        .eq("search_id", searchId);

      if (Array.isArray(existingProspects)) {
        const map: Record<string, string> = {};
        for (const p of existingProspects) {
          map[p.nombre_empresa] = p.id;
        }
        setImportedMap(map);
      }
    } catch (err) {
      if (process.env.NODE_ENV === "development") {
        console.error("[Engine] Error fetching results", err);
      }
    } finally {
      setLoading(false);
    }
  }, [searchId]);

  useEffect(() => {
    fetchSearchData();
  }, [fetchSearchData]);

  // Suscribirse a cambios en la tabla searches para actualizar cuando cambie a 'completado'
  useRealtimeSearchResults({
    searchId,
    onProspectInsert: () => {
      fetchSearchData();
    },
    onProspectUpdate: () => {},
    onAuditInsert: () => {},
  });

  const [extractedCount, setExtractedCount] = useState<number>(0);

  // Polling unificado: consulta Supabase y Apify para recuperar el avance parcial
  useEffect(() => {
    if (searchState === "procesando" || searchState === "pendiente") {
      const interval = setInterval(async () => {
        try {
          if (process.env.NODE_ENV === "development") {
            console.log("[Engine] Polling avance parcial...");
          }
          const { checkSearchFallback } = await import("@/app/actions/prospects.actions");
          const result = await checkSearchFallback(searchId);
          
          if (result.success) {
             if (result.data?.status === "procesando" && result.data?.partialCount !== undefined) {
               setExtractedCount(result.data.partialCount);
             } else if (result.data?.status === "completado") {
               // Refresh data y limpia contador si terminó
               await fetchSearchData();
               toast.success(`${result.data.count} prospectos encontrados.`);
             }
          }
        } catch (err) {
          console.error("[Engine] Error polling fallback:", err);
        }
        
        // También re-fetch normal por si el webhook funcionó por otro lado
        await fetchSearchData();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [searchState, searchId, fetchSearchData]);


  const handleImport = (place: ApifyPlace) => {
    const placeTitle = place.title || (place as any).name || "Sin nombre";
    const cost = calculateAuditCreditCost(Boolean(place.website));

    // Validar saldo antes de iniciar el pipeline IA
    if (userCredits !== null && userCredits < cost) {
      toast.error("Límite de Créditos Alcanzado", {
        description: `Esta auditoría requiere ${cost} créditos y solo tienes ${userCredits}. Espera tu fecha de renovación o contacta soporte.`,
        duration: 6000,
      });
      return;
    }

    setImportingTitle(placeTitle);
    startTransition(async () => {
      try {
        const result = await importProspectToCRM(searchId, place);
        if (result.success && result.data) {
          setImportedMap((prev) => ({
            ...prev,
            [placeTitle]: result.data!.prospectId,
          }));
          toast.success(`"${placeTitle}" importado y auditado con éxito.`);
          // Redirigir inmediatamente a la vista individual del prospecto importado
          router.push(`/prospectos/${result.data.prospectId}`);
        } else if (result.error === "INSUFFICIENT_CREDITS") {
          toast.error("Límite de Créditos Alcanzado", {
            description: "Has consumido tus créditos del periodo. Espera a tu fecha de renovación o contacta a soporte para un upgrade.",
            duration: 6000,
          });
        } else {
          toast.error(result.error || "Error al importar el prospecto");
        }
      } catch (err) {
        toast.error("Error inesperado al importar");
      } finally {
        setImportingTitle(null);
      }

    });
  };

  const currentCount = Math.max(stagedPlaces.length, extractedCount);
  const targetCount = requestedLimit > 0 ? requestedLimit : 10;
  const progressPercentage = Math.min(100, Math.round((currentCount / targetCount) * 100));

  return (
    <div className="space-y-4">
      {/* Banner de Estado */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-muted/40 border border-border rounded-xl">
        <div className="flex items-center gap-3">
          {searchState === "procesando" || searchState === "pendiente" ? (
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          )}
          <div>
            <h3 className="font-medium text-sm">
              {searchState === "procesando" || searchState === "pendiente"
                ? "Extrayendo empresas de Google Maps en segundo plano..."
                : "Búsqueda finalizada"}
            </h3>
            {searchState === "procesando" || searchState === "pendiente" ? (
              <div className="mt-1 flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span className="text-xs font-mono font-medium text-emerald-400 flex items-center gap-1">
                  <motion.span
                    key={currentCount}
                    initial={{ scale: 1.2, opacity: 0.5 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="inline-block"
                  >
                    {currentCount}
                  </motion.span>
                  / {targetCount} prospectos extraídos ({progressPercentage}%)
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                {currentCount} prospectos listos para auditar e importar.
              </p>
            )}
          </div>
        </div>
      </div>

      {originalQuery && originalQuery !== searchQuery && (
        <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs rounded-lg p-2.5 mb-3 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-emerald-400" />
          <span>Se corrigió automáticamente la búsqueda de &apos;{originalQuery}&apos; a &apos;{searchQuery}&apos;.</span>
        </div>
      )}

      {/* Mensajes de prospectos agotados o parciales */}
      {(searchState === "completado" || searchState === "error") && (
        <>
          {stagedPlaces.length === 0 && requestedLimit > 0 ? (
            <div className="bg-amber-500/10 border border-amber-500/20 text-amber-300 rounded-xl p-4 mt-4">
              <h3 className="font-semibold text-amber-500 dark:text-amber-400 mb-1">¡Has extraído todos los prospectos disponibles!</h3>
              <p className="text-sm text-amber-700 dark:text-amber-300/80">
                Ya no quedan negocios nuevos para &apos;{searchQuery}&apos; en &apos;{searchLocation}&apos;. Prueba buscando en municipios o zonas cercanas (ej. &apos;San Juan del Río&apos;) o usa una variante de categoría (ej. &apos;Ortodoncia&apos;, &apos;Clínica Dental&apos;).
              </p>
            </div>
          ) : stagedPlaces.length > 0 && requestedLimit > 0 && stagedPlaces.length < requestedLimit ? (
            <div className="text-sm text-muted-foreground bg-muted/40 p-3 rounded-lg border border-border">
              Se encontraron únicamente {stagedPlaces.length} prospectos nuevos. El resto ya se encuentra en tu historial de CRM.
            </div>
          ) : null}
        </>
      )}

      {/* Tabla de Resultados en Staging */}
      {(loading || searchState === "procesando" || searchState === "pendiente") && stagedPlaces.length === 0 ? (
        <ProspectsLoadingSkeleton />
      ) : (
        <Card className="border-border bg-card">
          <CardContent className="p-0">
            <Table className="table-fixed w-full">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="w-[30%] py-2 px-2">Empresa</TableHead>
                  <TableHead className="w-[35%] py-2 px-2">Teléfono / Dirección</TableHead>
                  <TableHead className="w-[15%] py-2 px-2">Google Rating</TableHead>
                  <TableHead className="w-[20%] py-2 px-2 text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {stagedPlaces.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="h-48 text-center py-8">
                      {originalQuery && originalQuery !== searchQuery ? (
                        <div className="flex flex-col items-center gap-3">
                          <span className="text-muted-foreground text-sm">
                            No encontramos resultados para &apos;{originalQuery}&apos;. ¿Quisiste decir <strong className="text-foreground">{searchQuery}</strong>?
                          </span>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              // Enlaza a crear una nueva búsqueda con los términos corregidos
                              const params = new URLSearchParams();
                              params.set('q', searchQuery);
                              if (searchLocation) params.set('loc', searchLocation);
                              router.push(`/buscar?${params.toString()}`);
                            }}
                          >
                            Buscar como &apos;{searchQuery}&apos;
                          </Button>
                        </div>
                      ) : (
                        <span className="text-muted-foreground text-sm">
                          No se encontraron prospectos en esta búsqueda.
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ) : (
                  stagedPlaces.map((place, index) => {
                    const title = place.title || (place as any).name || "Sin nombre";
                    const prospectId = importedMap[title];
                    const isImported = Boolean(prospectId);
                    const isImporting = importingTitle === title;

                    return (
                      <TableRow key={index} className="border-border hover:bg-muted/30">
                        <TableCell className="py-2 px-2 align-top font-medium">
                          <div className="flex flex-col max-w-[200px] sm:max-w-[250px]">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-semibold text-foreground truncate">
                                {title}
                              </span>
                              {place.en_crm && (
                                <span className="text-[10px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-md border border-primary/20 shrink-0">
                                  En CRM
                                </span>
                              )}
                            </div>

                            {place.website ? (
                              <a
                                href={place.website}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center text-xs text-muted-foreground hover:text-primary transition-colors mt-0.5 truncate max-w-full"
                              >
                                <Globe className="w-3 h-3 mr-1 shrink-0" />
                                <span className="truncate">{place.website.replace(/^https?:\/\//, "").replace(/\/$/, "")}</span>
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">Sin sitio web</span>
                            )}
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-2 align-top text-xs text-muted-foreground">
                          <div className="space-y-0.5 min-w-0">
                            {place.phone ? (
                              <span className="text-xs text-zinc-700 dark:text-zinc-200 block font-mono truncate">{place.phone}</span>
                            ) : (
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400 border border-zinc-300/50 dark:border-zinc-700/50">
                                Sin teléfono
                              </span>
                            )}
                            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate max-w-[220px]" title={place.address || undefined}>
                              {place.address || 'Sin dirección registrada'}
                            </p>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-2 align-top">
                          <div className="flex flex-col items-start gap-1 min-w-0">
                            <div className="flex items-center gap-1 text-xs text-amber-400 font-medium">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{place.totalScore || 'N/A'}</span>
                              {place.reviewsCount ? <span className="text-zinc-600 dark:text-zinc-500 text-[11px]">({place.reviewsCount})</span> : null}
                            </div>
                            <button 
                              onClick={() => setPreviewPlace(place)}
                              className="inline-flex items-center gap-1 text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 underline transition-colors"
                            >
                              <Eye className="w-3 h-3"/>
                              Vista Previa
                            </button>
                          </div>
                        </TableCell>

                        <TableCell className="py-2 px-2 align-top text-right">
                          <div className="flex flex-col sm:flex-row items-end sm:items-center justify-end gap-1.5">

                            {isImported ? (
                              <div className="flex items-center gap-1.5">
                                <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-500">
                                  <CheckCircle2 className="w-3 h-3" />
                                  Importado
                                </span>
                                <Link
                                  href={`/prospectos/${prospectId}`}
                                  className={cn(
                                    buttonVariants({ variant: "outline", size: "sm" }),
                                    "px-2 py-1.5 h-auto text-[11px] gap-1"
                                  )}
                                >
                                  Ver
                                  <ExternalLink className="w-3 h-3 shrink-0" />
                                </Link>
                              </div>
                            ) : (
                              <Button
                                size="sm"
                                disabled={isImporting || (userCredits !== null && userCredits < calculateAuditCreditCost(Boolean(place.website)))}
                                onClick={() => handleImport(place)}
                                className="px-2 py-1.5 h-auto text-[11px] gap-1 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
                              >
                                {isImporting ? (
                                  <>
                                    <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                                    <span className="hidden sm:inline">Auditando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Sparkles className="w-3 h-3 shrink-0" />
                                    <span className="hidden xl:inline">Auditar e Importar</span>
                                    <span className="xl:hidden">Importar</span>
                                    <span className="bg-black/20 text-emerald-100 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ml-0.5">
                                      {calculateAuditCreditCost(Boolean(place.website))} cr
                                    </span>
                                  </>
                                )}
                              </Button>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Modal de Vista Previa */}
      <Dialog open={!!previewPlace} onOpenChange={(open) => !open && setPreviewPlace(null)}>
        <DialogContent className="sm:max-w-lg bg-white dark:bg-zinc-900/95 backdrop-blur-xl border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-6 text-zinc-900 dark:text-zinc-100">
          <DialogHeader className="space-y-4">
            <div>
              <div className="inline-flex items-center rounded-full border border-zinc-200 dark:border-zinc-700/50 bg-zinc-100 dark:bg-zinc-800/50 px-2.5 py-0.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 mb-3">
                <CheckCircle2 className="w-3.5 h-3.5 mr-1.5 text-emerald-500 dark:text-emerald-400" />
                Prospecto Verificado - Google Maps
              </div>
              <DialogTitle className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-white flex items-center gap-3">
                {previewPlace?.title || (previewPlace as any)?.name || "Sin nombre"}
              </DialogTitle>
              {previewPlace?.totalScore && (
                <div className="mt-3 inline-flex items-center gap-1.5 text-sm bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 px-3 py-1 rounded-full font-medium">
                  <Star className="w-4 h-4 fill-amber-500 text-amber-500" />
                  {previewPlace.totalScore} ({previewPlace.reviewsCount || 0} reseñas)
                </div>
              )}
            </div>
            <DialogDescription className="sr-only">
              Vista previa de la información extraída de Google Maps.
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 gap-3 py-4">
            <div className="flex items-center gap-4 bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
              <div className="flex-shrink-0 bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                <MapPin className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Dirección</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">{previewPlace?.address || "No disponible"}</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4 bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
              <div className="flex-shrink-0 bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                <Phone className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Teléfono</span>
                <span className="text-sm text-zinc-800 dark:text-zinc-200 mt-0.5 truncate">{previewPlace?.phone || "No disponible"}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
              <div className="flex-shrink-0 bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                <Globe className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Sitio Web</span>
                {previewPlace?.website ? (
                  <a href={previewPlace.website.startsWith('http') ? previewPlace.website : `https://${previewPlace.website}`} target="_blank" rel="noreferrer" className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center justify-between min-w-0 gap-2 mt-0.5 transition-colors max-w-full">
                    <span className="truncate min-w-0 flex-1">
                      {(() => {
                        const rawUrl = previewPlace.website;
                        if (!rawUrl) return '';
                        try {
                          const urlObj = new URL(rawUrl.startsWith('http') ? rawUrl : `https://${rawUrl}`);
                          return urlObj.hostname.replace(/^www\./, '');
                        } catch {
                          return rawUrl.split('?')[0].replace(/^https?:\/\/(www\.)?/, '').replace(/\/$/, '');
                        }
                      })()}
                    </span>
                    <ExternalLink className="w-3.5 h-3.5 flex-shrink-0" />
                  </a>
                ) : (
                  <span className="text-sm text-zinc-500 dark:text-zinc-500 italic mt-0.5">No disponible</span>
                )}
              </div>
            </div>

            <div className="flex items-center gap-4 bg-zinc-50/80 dark:bg-zinc-800/30 border border-zinc-200/60 dark:border-zinc-800/50 p-3.5 rounded-xl transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800/50">
              <div className="flex-shrink-0 bg-white dark:bg-zinc-800 p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-700/50 shadow-inner">
                <ExternalLink className="w-5 h-5 text-zinc-500 dark:text-zinc-400" />
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold uppercase tracking-wider">Google Maps</span>
                {previewPlace?.url || (previewPlace as any)?.googleMapsUrl ? (
                  <a href={previewPlace?.url || (previewPlace as any)?.googleMapsUrl} target="_blank" rel="noreferrer" className="text-sm text-emerald-600 hover:text-emerald-700 dark:text-emerald-400 dark:hover:text-emerald-300 inline-flex items-center gap-1.5 mt-0.5 transition-colors truncate">
                    Ver perfil completo en Google Maps
                  </a>
                ) : (
                  <span className="text-sm text-zinc-500 dark:text-zinc-500 italic mt-0.5">URL no disponible</span>
                )}
              </div>
            </div>
          </div>
          
          <div className="flex justify-end items-center gap-3 mt-4 pt-4 border-t border-zinc-200 dark:border-zinc-800/50">
            <Button variant="ghost" className="text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white" onClick={() => setPreviewPlace(null)}>
              Cerrar
            </Button>
            {!importedMap[previewPlace?.title || (previewPlace as any)?.name || ""] && (
              <Button 
                onClick={() => {
                  if (previewPlace) {
                    const cost = calculateAuditCreditCost(Boolean(previewPlace.website));
                    if (userCredits !== null && userCredits < cost) {
                      toast.error("Límite de Créditos Alcanzado", {
                        description: `Esta auditoría requiere ${cost} créditos y solo tienes ${userCredits}. Espera tu fecha de renovación o contacta soporte.`,
                        duration: 6000,
                      });
                      return;
                    }
                    handleImport(previewPlace);
                    setPreviewPlace(null);
                  }
                }}
                disabled={importingTitle === (previewPlace?.title || (previewPlace as any)?.name)}
                className="bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold shadow-md shadow-emerald-500/20 px-6 gap-2 transition-all"
              >
                <Sparkles className="w-4 h-4" />
                Auditar e Importar
                {previewPlace && (
                  <span className="bg-black/20 text-emerald-100 text-[10px] font-semibold px-1.5 py-0.5 rounded-md">
                    {calculateAuditCreditCost(Boolean(previewPlace.website))} cr
                  </span>
                )}
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

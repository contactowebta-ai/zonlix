"use client";

import React, { useState, useMemo, useTransition } from "react";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScoreBadge } from "@/components/prospects/score-badge";
import { StatusSelect } from "@/components/prospects/status-select";
import { Search, Globe, Star, EyeOff, ExternalLink, Download, PlusCircle, CheckCircle2, XCircle, MessageSquare, Phone, MessageCircle } from "lucide-react";
import type { ProspectRow, AuditRow, ProspectStatus, ScoreTier } from "@/types";
import { cn, prospectStatusLabels, getPhoneInfo, getCleanDomain } from "@/lib/utils";

import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetTrigger } from "@/components/ui/sheet";
import { pushToCrm } from "@/app/actions/prospects.actions";
import { toast } from "sonner";

export interface ProspectWithAudit extends ProspectRow {
  audit?: AuditRow | null;
}

interface ProspectsTableProps {
  prospects: ProspectWithAudit[];
}

export function ProspectsTable({ prospects }: ProspectsTableProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<string>("todos");
  const [selectedTier, setSelectedTier] = useState<string>("todos");
  const [hideWithoutWebsite, setHideWithoutWebsite] = useState(false);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPendingCRM, startTransitionCRM] = useTransition();

  // Filtrado y Ordenamiento por defecto: tier "verde" primero, luego por score ascendente
  const filteredProspects = useMemo(() => {
    return prospects
      .filter((p) => {
        // Filtro texto
        if (searchTerm.trim()) {
          const term = searchTerm.toLowerCase();
          const matchesName = p.nombre_empresa.toLowerCase().includes(term);
          const matchesPhone = p.telefono?.toLowerCase().includes(term) ?? false;
          if (!matchesName && !matchesPhone) return false;
        }

        // Filtro status
        if (selectedStatus !== "todos" && p.status !== selectedStatus) {
          return false;
        }

        // Filtro tier
        const tier = p.audit?.tier;
        if (selectedTier !== "todos" && tier !== selectedTier) {
          return false;
        }

        // Toggle sin sitio web
        if (hideWithoutWebsite && !p.sitio_web) {
          return false;
        }

        return true;
      })
      .sort((a, b) => {
        const tierPriority: Record<string, number> = { verde: 1, amarillo: 2, rojo: 3 };
        const tierA = a.audit?.tier ? tierPriority[a.audit.tier] : 4;
        const tierB = b.audit?.tier ? tierPriority[b.audit.tier] : 4;

        if (tierA !== tierB) {
          return tierA - tierB;
        }

        // Si es el mismo tier, ordenar por score ascendente (menor score = mayor oportunidad)
        const scoreA = a.audit?.score ?? 99;
        const scoreB = b.audit?.score ?? 99;
        return scoreA - scoreB;
      });
  }, [prospects, searchTerm, selectedStatus, selectedTier, hideWithoutWebsite]);

  const toggleSelectAll = () => {
    if (selectedIds.size === filteredProspects.length && filteredProspects.length > 0) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredProspects.map(p => p.id)));
    }
  };

  const toggleSelect = (id: string) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleExportCSV = () => {
    const itemsToExport = selectedIds.size > 0 
      ? prospects.filter(p => selectedIds.has(p.id))
      : filteredProspects;

    if (itemsToExport.length === 0) return;

    const headers = ["Empresa", "Dominio", "Teléfono", "Rating_Google", "Numero_Resenas", "Score_IA", "Oportunidad"];
    
    const rows = itemsToExport.map(p => {
      const dominio = p.sitio_web ? p.sitio_web.replace(/^https?:\/\//, "").replace(/\/$/, "") : "";
      const telefono = p.whatsapp || p.telefono || "";
      const rating = p.calificacion_google || "";
      const resenas = p.num_resenas || "";
      const scoreIA = p.audit?.score || "";
      const oportunidad = p.audit?.tier || "";
      
      return [
        `"${p.nombre_empresa.replace(/"/g, '""')}"`,
        `"${dominio}"`,
        `"${telefono}"`,
        `"${rating}"`,
        `"${resenas}"`,
        `"${scoreIA}"`,
        `"${oportunidad}"`
      ].join(",");
    });

    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", "prospectos_zonlix.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleAddToCrm = (prospectId: string) => {
    startTransitionCRM(async () => {
      const res = await pushToCrm(prospectId);
      if (res.success) {
        toast.success("Prospecto guardado en tu CRM");
      } else {
        toast.error(res.error || "Error al agregar al CRM");
      }
    });
  };

  return (
    <div className="space-y-4">
      {/* Barra de Filtros */}
      <Card className="border-border bg-card p-4">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          <div className="flex flex-1 flex-col md:flex-row gap-3">
            {/* Buscador texto */}
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nombre de empresa o teléfono..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 h-9 text-xs"
              />
            </div>

            {/* Select Status */}
            <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val ?? "todos")}>
              <SelectTrigger className="w-full md:w-[170px] h-9 text-xs">
                <SelectValue placeholder="Estado" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Estado: Todos</SelectItem>
                {Object.entries(prospectStatusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key} className="text-xs">
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Select Tier */}
            <Select value={selectedTier} onValueChange={(val) => setSelectedTier(val ?? "todos")}>
              <SelectTrigger className="w-full md:w-[160px] h-9 text-xs">
                <SelectValue placeholder="Oportunidad (Tier)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos" className="text-xs">Puntuación: Todos</SelectItem>
                <SelectItem value="verde" className="text-xs">🟢 Alta (Verde)</SelectItem>
                <SelectItem value="amarillo" className="text-xs">🟡 Media (Amarillo)</SelectItem>
                <SelectItem value="rojo" className="text-xs">🔴 Baja (Rojo)</SelectItem>
              </SelectContent>
            </Select>

          </div>

          <div className="flex items-center gap-2">
            {/* Export CSV Button */}
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handleExportCSV} 
              disabled={filteredProspects.length === 0}
              className="text-xs h-9 shrink-0 bg-white dark:bg-[#151D2A] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
            >
              <Download className="w-3.5 h-3.5 mr-2" />
              Descargar CSV {selectedIds.size > 0 && `(${selectedIds.size})`}
            </Button>

            {/* Toggle Ocultar sin sitio web */}
            <button
              onClick={() => setHideWithoutWebsite(!hideWithoutWebsite)}
              className={cn(
                "shrink-0 flex items-center gap-2 px-3.5 h-9 text-xs font-medium rounded-xl border transition-all duration-200 cursor-pointer select-none",
                hideWithoutWebsite
                  ? "bg-emerald-50 dark:bg-emerald-500/10 border-emerald-200 dark:border-emerald-500/50 text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/10"
                  : "bg-white dark:bg-[#151D2A] border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/80"
              )}
            >
              {hideWithoutWebsite ? (
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              ) : (
                <EyeOff className="w-3.5 h-3.5 text-slate-400 dark:text-slate-500" />
              )}
              Solo con sitio web
            </button>
          </div>
        </div>
      </Card>

      {/* Tabla de Resultados */}
      <Card className="border-border bg-card">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="w-[40px]">
                  <Checkbox 
                    checked={selectedIds.size > 0 && selectedIds.size === filteredProspects.length}
                    onCheckedChange={toggleSelectAll}
                    aria-label="Seleccionar todos"
                  />
                </TableHead>
                <TableHead>Empresa</TableHead>
                <TableHead>Puntuación IA</TableHead>
                <TableHead>Teléfono / WhatsApp</TableHead>
                <TableHead>Calificación Google</TableHead>
                <TableHead>Estado Pipeline</TableHead>
                <TableHead className="text-right">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProspects.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-40 text-center text-muted-foreground text-sm">
                    <div className="flex flex-col items-center justify-center">
                      <p>No se encontraron prospectos con los filtros seleccionados.</p>
                      <Link href="/buscar" className="border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 mt-3 rounded-xl px-4 py-2 text-sm transition-colors">
                        Ir a Buscar Prospectos
                      </Link>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredProspects.map((prospect) => (
                  <TableRow key={prospect.id} className="hover:bg-muted/60 transition-colors">
                    <TableCell>
                      <Checkbox 
                        checked={selectedIds.has(prospect.id)}
                        onCheckedChange={() => toggleSelect(prospect.id)}
                        aria-label={`Seleccionar ${prospect.nombre_empresa}`}
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <div className="flex flex-col">
                        <Link href={`/prospectos/${prospect.id}`} className="text-sm font-semibold hover:text-primary transition-colors">
                          {prospect.nombre_empresa}
                        </Link>
                        {prospect.sitio_web ? (
                          <a
                            href={prospect.sitio_web.startsWith('http') ? prospect.sitio_web : `https://${prospect.sitio_web}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[11px] text-emerald-400/90 hover:text-emerald-300 hover:underline font-mono truncate max-w-[200px] block mt-1"
                            title={prospect.sitio_web}
                          >
                            {getCleanDomain(prospect.sitio_web)}
                          </a>
                        ) : (
                          <span className="text-[11px] text-zinc-500 block mt-1">Sin sitio web</span>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="align-middle">
                      <Sheet>
                        <SheetTrigger className="cursor-pointer hover:opacity-80 transition-opacity text-left bg-transparent border-0 p-0 m-0">
                          <ScoreBadge score={prospect.audit?.score} tier={prospect.audit?.tier} showOpportunityLabel />
                        </SheetTrigger>
                        <SheetContent className="overflow-y-auto sm:max-w-md w-full border-l border-border/50 bg-background/95 backdrop-blur-sm shadow-2xl">
                          <SheetHeader>
                            <SheetTitle>{prospect.nombre_empresa}</SheetTitle>
                            <SheetDescription>
                              {prospect.sitio_web ? (
                                <a href={prospect.sitio_web} target="_blank" rel="noreferrer" className="flex items-center hover:underline">
                                  <Globe className="w-3 h-3 mr-1" />
                                  {prospect.sitio_web}
                                </a>
                              ) : "Sin sitio web"}
                            </SheetDescription>
                          </SheetHeader>
                          <div className="mt-8 space-y-6">
                            {prospect.audit ? (
                              <>
                                <div>
                                  <h4 className="font-semibold text-rose-500 dark:text-rose-400 flex items-center gap-2 mb-3">
                                    <XCircle className="w-4 h-4"/> 
                                    Puntos de Dolor Detectados
                                  </h4>
                                  <ul className="list-disc list-outside ml-4 text-sm text-foreground/80 space-y-1.5">
                                    {Array.isArray(prospect.audit.puntos_dolor) 
                                      ? prospect.audit.puntos_dolor.map((f: any, i: number) => <li key={i}>{String(f)}</li>)
                                      : <li>No se registraron puntos de dolor.</li>}
                                  </ul>
                                </div>
                                <div>
                                  <h4 className="font-semibold text-primary flex items-center gap-2 mb-3">
                                    <MessageSquare className="w-4 h-4"/> 
                                    Resumen IA (Angle)
                                  </h4>
                                  <p className="text-sm text-foreground/90 bg-muted/40 p-4 rounded-xl border border-border/50 leading-relaxed shadow-sm">
                                    {prospect.audit.resumen_ia || "No hay resumen disponible."}
                                  </p>
                                </div>
                              </>
                            ) : (
                              <p className="text-sm text-muted-foreground text-center py-8">No hay auditoría de IA disponible para este prospecto.</p>
                            )}
                          </div>
                        </SheetContent>
                      </Sheet>
                    </TableCell>

                    <TableCell className="text-xs">
                      {prospect.whatsapp || prospect.telefono ? (
                        (() => {
                          const phoneInfo = getPhoneInfo(prospect.whatsapp || prospect.telefono || "");
                          return (
                            <div className="flex items-center gap-1.5">
                              <a 
                                href={`tel:+${phoneInfo.cleanNumber}`}
                                className="flex items-center gap-1.5 px-2 py-1.5 rounded-md bg-secondary hover:bg-secondary/80 text-secondary-foreground transition-colors border border-border/50"
                                title="Llamar"
                              >
                                <Phone className="w-3.5 h-3.5" />
                                <span className="font-medium">{phoneInfo.formattedNumber || (prospect.whatsapp || prospect.telefono)}</span>
                              </a>
                              {phoneInfo.isFixed ? (
                                <button 
                                  disabled
                                  className="p-1.5 rounded-md bg-muted text-muted-foreground cursor-help opacity-60 border border-border/50"
                                  title="Probable teléfono fijo / conmutador. WhatsApp no disponible."
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              ) : (
                                <a 
                                  href={`https://wa.me/${phoneInfo.cleanNumber}`}
                                  target="_blank"
                                  rel="noreferrer" 
                                  className="p-1.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 transition-colors border border-emerald-500/20"
                                  title="Enviar WhatsApp"
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </a>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="text-muted-foreground italic">No disponible</span>
                      )}
                    </TableCell>

                    <TableCell>
                      {prospect.calificacion_google ? (
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                          <span className="font-medium">{prospect.calificacion_google}</span>
                          <span className="text-muted-foreground">({prospect.num_resenas ?? 0})</span>
                        </div>
                      ) : (
                        <span className="text-xs text-muted-foreground">N/A</span>
                      )}
                    </TableCell>

                    <TableCell>
                      <StatusSelect prospectId={prospect.id} currentStatus={prospect.status} size="sm" />
                    </TableCell>

                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        {!prospect.status && (
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => handleAddToCrm(prospect.id)}
                            disabled={isPendingCRM}
                            className="h-8 px-2.5 text-xs border-emerald-500/20 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300 bg-emerald-500/5 dark:bg-emerald-500/10 transition-all font-medium"
                          >
                            <PlusCircle className="w-3.5 h-3.5 mr-1.5" />
                            + CRM
                          </Button>
                        )}
                        <Link
                          href={`/prospectos/${prospect.id}`}
                          className={cn(buttonVariants({ variant: "ghost", size: "sm" }), "h-8 px-2 text-xs")}
                        >
                          Ver detalle
                          <ExternalLink className="w-3.5 h-3.5 ml-1" />
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateProfile, reAuditProfile } from "@/app/actions/profile.actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { X, Plus, Sparkles, Building2, Globe, Target, DollarSign, Edit, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import type { ProfileRow } from "@/types/database.types";

interface OnboardingFormProps {
  initialProfile?: ProfileRow | null;
}

function Linkedin(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
      <rect width="4" height="12" x="2" y="9" />
      <circle cx="4" cy="4" r="2" />
    </svg>
  );
}

function Instagram(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <rect width="20" height="20" x="2" y="2" rx="5" ry="5" />
      <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
      <line x1="17.5" x2="17.51" y1="6.5" y2="6.5" />
    </svg>
  );
}

function Facebook(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
    </svg>
  );
}

const SECTORES_OPCIONES = [
  "Marketing y Publicidad",
  "Desarrollo de Software y Web",
  "Consultoría de Negocios",
  "Diseño y Branding",
  "Ventas y Telemarketing",
  "Servicios Profesionales",
  "Otro Sector",
];

const ICP_TAMANOS = ["Microempresa (1-5 emp)", "Pyme (6-20 emp)", "Mediana (21-100 emp)", "Corporativo (+100)"];

export function OnboardingForm({ initialProfile }: OnboardingFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isSaving, setIsSaving] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [auditError, setAuditError] = useState<string | null>(null);
  const [isQuotaExhausted, setIsQuotaExhausted] = useState(false);

  const [isEditing, setIsEditing] = useState(!initialProfile?.onboarding_completado);

  const initialVentajas = Array.isArray(initialProfile?.ventajas)
    ? (initialProfile.ventajas as string[])
    : [];

  const initialIcp = (initialProfile?.icp as { tamano?: string; zona?: string; necesidades?: string }) ?? {};

  const [sector, setSector] = useState(initialProfile?.sector ?? "");
  const [sectorPersonalizado, setSectorPersonalizado] = useState(initialProfile?.sector_personalizado ?? "");
  const [descripcion, setDescripcion] = useState(initialProfile?.descripcion ?? "");
  const [sitioWeb, setSitioWeb] = useState(initialProfile?.sitio_web ?? "");
  const [portafolioUrl, setPortafolioUrl] = useState(initialProfile?.portafolio_url ?? "");
  const [precioPromedio, setPrecioPromedio] = useState<string>(
    initialProfile?.precio_promedio ? String(initialProfile.precio_promedio) : ""
  );

  const [linkedinUrl, setLinkedinUrl] = useState(initialProfile?.linkedin_url ?? "");
  const [instagramUrl, setInstagramUrl] = useState(initialProfile?.instagram_url ?? "");
  const [facebookUrl, setFacebookUrl] = useState(initialProfile?.facebook_url ?? "");

  const [ventajas, setVentajas] = useState<string[]>(initialVentajas);
  const [nuevaVentaja, setNuevaVentaja] = useState("");

  const [icpTamano, setIcpTamano] = useState(initialIcp.tamano ?? "");
  const [icpZona, setIcpZona] = useState(initialIcp.zona ?? "");

  // Store the IA audit result to display if generated
  const [diagnosticoIa, setDiagnosticoIa] = useState<any>(initialProfile?.diagnostico_ia ?? null);

  const handleAddVentaja = () => {
    const trimmed = nuevaVentaja.trim();
    if (!trimmed) return;
    if (ventajas.length >= 3) {
      toast.error("Máximo 3 ventajas competitivas");
      return;
    }
    if (ventajas.includes(trimmed)) return;
    setVentajas([...ventajas, trimmed]);
    setNuevaVentaja("");
  };

  const handleRemoveVentaja = (index: number) => {
    setVentajas(ventajas.filter((_, i) => i !== index));
  };

  const handleReAudit = () => {
    setIsAuditing(true);
    setAuditError(null);
    startTransition(async () => {
      try {
        const result = await reAuditProfile();
        if (result.success && result.data?.diagnostico_ia) {
          setDiagnosticoIa(result.data.diagnostico_ia);
          setAuditError(null);
          toast.success("Auditoría generada con éxito");
        } else {
          const msg = result.error ?? "No se pudo generar la auditoría";
          setAuditError(msg);
          
          if (msg === "INSUFFICIENT_CREDITS") {
            toast.error("Límite de Créditos Alcanzado", {
              description: "Has consumido tus créditos del periodo. Espera a tu fecha de renovación o contacta a soporte para un upgrade.",
              duration: 6000,
            });
          } else if (msg.includes("Servicio de IA ocupado") || msg.includes("saturado") || msg.includes("conectado")) {
            setIsQuotaExhausted(true);
            toast.error(msg, {
              className: "bg-amber-50 text-amber-800 border-amber-200",
            });
          } else {
            toast.error(msg);
          }
        }
      } catch (error) {
        const msg = "Ocurrió un error al contactar al servidor.";
        setAuditError(msg);
        toast.error(msg);
      } finally {
        setIsAuditing(false);
      }
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!sector) {
      toast.error("Selecciona un sector para tu agencia o empresa");
      return;
    }

    if (sector === "Otro Sector" && !sectorPersonalizado.trim()) {
      toast.error("Especifica tu sector");
      return;
    }

    if (ventajas.length === 0) {
      toast.error("Agrega al menos 1 ventaja competitiva");
      return;
    }

    setIsSaving(true);
    startTransition(async () => {
      try {
        const result = await updateProfile({
          sector,
          sector_personalizado: sector === "Otro Sector" ? sectorPersonalizado : undefined,
          descripcion,
          sitio_web: sitioWeb || undefined,
          portafolio_url: portafolioUrl || undefined,
          precio_promedio: precioPromedio ? Number(precioPromedio) : undefined,
          linkedin_url: linkedinUrl || undefined,
          instagram_url: instagramUrl || undefined,
          facebook_url: facebookUrl || undefined,
          ventajas,
          icp: {
            tamano: icpTamano || undefined,
            zona: icpZona || undefined,
          },
        });

        if (result.success) {
          toast.success("Perfil guardado con éxito.");
          setIsEditing(false);
        } else {
          toast.error(result.error ?? "No se pudo guardar el perfil");
        }
      } catch (error) {
        toast.error("Error inesperado al guardar el perfil");
      } finally {
        setIsSaving(false);
      }
    });
  };

  if (!isEditing) {
    return (
      <div className="space-y-6 max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Dashboard de Agencia</h2>
            <p className="text-muted-foreground">Resumen de tu presencia digital y perfil de negocio.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" className="px-4 py-2 text-sm rounded-xl flex items-center shadow-sm bg-white dark:bg-slate-800/80 border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-medium hover:bg-slate-100 dark:hover:bg-slate-700 hover:text-slate-900 transition-all" onClick={() => setIsEditing(true)}>
              <Edit className="w-4 h-4 mr-2" />
              Editar Perfil
            </Button>
            {diagnosticoIa && (
              <Button onClick={handleReAudit} disabled={isPending || isAuditing} className="px-4 py-2 rounded-xl flex items-center bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 dark:shadow-emerald-500/20 transition-all duration-200">
                <RefreshCw className={`w-4 h-4 mr-2 ${isAuditing ? "animate-spin" : ""}`} />
                Regenerar Auditoría con IA
              </Button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="col-span-1 md:col-span-2 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                Resumen de Negocio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Sector / Industria</p>
                  <p>{sector === "Otro Sector" ? sectorPersonalizado : sector}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Ticket Promedio</p>
                  <p>{precioPromedio ? `$${precioPromedio} MXN` : "No especificado"}</p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Sitio Web</p>
                  <p>
                    {sitioWeb ? (
                      <a href={sitioWeb} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {sitioWeb}
                      </a>
                    ) : (
                      "No especificado"
                    )}
                  </p>
                </div>
                <div>
                  <p className="font-semibold text-slate-500 dark:text-slate-400">Portafolio</p>
                  <p>
                    {portafolioUrl ? (
                      <a href={portafolioUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                        {portafolioUrl}
                      </a>
                    ) : (
                      "No especificado"
                    )}
                  </p>
                </div>
              </div>
              <div className="pt-2">
                <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm mb-1">Descripción</p>
                <p className="text-sm">{descripcion || "Sin descripción"}</p>
              </div>
              <div className="pt-2">
                <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm mb-2">Ventajas Competitivas</p>
                <div className="flex flex-wrap gap-2">
                  {ventajas.length > 0 ? (
                    ventajas.map((v, i) => (
                      <Badge key={i} variant="secondary" className="bg-primary/10 text-primary border-primary/20">
                        {v}
                      </Badge>
                    ))
                  ) : (
                    <p className="text-sm italic text-muted-foreground">No definidas</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="col-span-1 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Globe className="w-5 h-5 text-primary" />
                Redes Sociales
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <Linkedin className="h-5 w-5 min-w-[20px] text-[#0077B5] flex-shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs">LinkedIn</p>
                    {linkedinUrl ? (
                      <a href={linkedinUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">
                        {linkedinUrl}
                      </a>
                    ) : (
                      <p className="text-muted-foreground italic">No conectada</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Instagram className="h-5 w-5 min-w-[20px] text-[#E1306C] flex-shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs">Instagram</p>
                    {instagramUrl ? (
                      <a href={instagramUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">
                        {instagramUrl}
                      </a>
                    ) : (
                      <p className="text-muted-foreground italic">No conectada</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Facebook className="h-5 w-5 min-w-[20px] text-[#1877F2] flex-shrink-0" />
                  <div className="overflow-hidden">
                    <p className="font-semibold text-slate-500 dark:text-slate-400 text-xs">Facebook</p>
                    {facebookUrl ? (
                      <a href={facebookUrl} target="_blank" rel="noreferrer" className="text-primary hover:underline truncate block">
                        {facebookUrl}
                      </a>
                    ) : (
                      <p className="text-muted-foreground italic">No conectada</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {diagnosticoIa ? (
          <Card className="border-primary/30 bg-primary/5 mt-6 shadow-sm overflow-hidden">
            <div className="h-1 w-full bg-gradient-to-r from-primary to-primary/40"></div>
            <CardHeader className="pb-3 border-b border-primary/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-primary">
                  <Sparkles className="w-5 h-5" />
                  <CardTitle className="text-lg">Diagnóstico Estratégico e IA</CardTitle>
                </div>
              </div>
              <CardDescription className="text-sm">
                Generado por Gemini AI basado en tu perfil y presencia digital.
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>
                  Propuesta de Valor
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {diagnosticoIa.diagnostico_propuesta}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  Oportunidades de Mejora
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {diagnosticoIa.oportunidades}
                </p>
              </div>
              <div className="space-y-2">
                <h4 className="font-bold text-foreground text-xs uppercase tracking-wider flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                  Sugerencias
                </h4>
                <p className="text-muted-foreground leading-relaxed">
                  {diagnosticoIa.sugerencias}
                </p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card mt-6 shadow-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl text-slate-900 dark:text-slate-100 font-semibold">Diagnóstico Estratégico de Agencia</CardTitle>
              <CardDescription className="text-slate-500 dark:text-slate-400">
                Aún no has generado el análisis de tu propuesta de valor y presencia digital.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col items-center pt-4 pb-6 gap-3">
              <Button onClick={handleReAudit} disabled={isPending || isAuditing || isQuotaExhausted} className="group px-6 py-3 rounded-xl flex items-center gap-2 transition-all duration-200 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-md shadow-emerald-600/20 dark:bg-emerald-500 dark:hover:bg-emerald-400 dark:text-slate-950 dark:shadow-emerald-500/20">
                <Sparkles className={`w-4 h-4 transition-transform duration-300 group-hover:scale-110 ${isAuditing ? "animate-spin" : ""}`} />
                {isAuditing ? "Generando diagnóstico estratégico..." : "Generar Auditoría con IA"}
              </Button>
              {auditError && (
                <div className="bg-amber-50 border border-amber-200 text-amber-800 text-xs p-3 rounded-xl max-w-md text-center mt-2 flex items-center gap-2">
                  <span className="shrink-0 font-bold">⚠️</span>
                  <p>{auditError}</p>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-6xl mx-auto w-full">
      <Card className="bg-card border border-border shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl p-6">
        <CardHeader>
          <div className="flex items-center gap-2 text-primary mb-1">
            <Building2 className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-wide uppercase">Configuración de Negocio</span>
          </div>
          <CardTitle className="text-2xl font-bold">Perfil de tu Agencia / Empresa</CardTitle>
          <CardDescription>
            Configura tu propuesta de valor. La IA usará esta información para personalizar los mensajes de prospección y manejar objeciones.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">

          {/* Fila 1: Sector | Ticket Promedio | Zona Geográfica */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sector">Sector / Industria *</Label>
              <Select value={sector} onValueChange={(val) => setSector(val ?? "")} disabled={isPending}>
                <SelectTrigger id="sector">
                  <SelectValue placeholder="Selecciona tu sector" />
                </SelectTrigger>
                <SelectContent>
                  {SECTORES_OPCIONES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {sector === "Otro Sector" && (
                <div className="mt-2">
                  <Input
                    placeholder="Especifica tu sector..."
                    value={sectorPersonalizado}
                    onChange={(e) => setSectorPersonalizado(e.target.value)}
                    disabled={isPending}
                  />
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="precio">Ticket / Precio promedio (MXN)</Label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="precio"
                  type="number"
                  placeholder="ej. 15000"
                  value={precioPromedio}
                  onChange={(e) => setPrecioPromedio(e.target.value)}
                  className="pl-9"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="icpZona">Zona Geográfica Preferida</Label>
              <Input
                id="icpZona"
                placeholder="ej. Querétaro, CDMX, Todo México"
                value={icpZona}
                onChange={(e) => setIcpZona(e.target.value)}
                disabled={isPending}
              />
            </div>
          </div>

          {/* Fila 2: Sitio Web | Portafolio | Tamaño Empresa */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="sitioWeb">Sitio Web</Label>
              <div className="relative">
                <Globe className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="sitioWeb"
                  type="url"
                  placeholder="https://tuagencia.com"
                  value={sitioWeb}
                  onChange={(e) => setSitioWeb(e.target.value)}
                  className="pl-9"
                  disabled={isPending}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="portafolioUrl">Portafolio / Casos de éxito (URL)</Label>
              <Input
                id="portafolioUrl"
                type="url"
                placeholder="https://tuagencia.com/casos"
                value={portafolioUrl}
                onChange={(e) => setPortafolioUrl(e.target.value)}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="icpTamano">Tamaño de empresa objetivo</Label>
              <Select value={icpTamano} onValueChange={(val) => setIcpTamano(val ?? "")} disabled={isPending}>
                <SelectTrigger id="icpTamano">
                  <SelectValue placeholder="Selecciona tamaño" />
                </SelectTrigger>
                <SelectContent>
                  {ICP_TAMANOS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fila 3: Redes Sociales (3 cols) */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold">Redes Sociales Oficiales</h4>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1">
                <Label htmlFor="linkedinUrl" className="text-xs">LinkedIn</Label>
                <div className="relative">
                  <Linkedin className="absolute left-3 top-2.5 h-4 w-4 text-[#0077B5]" />
                  <Input
                    id="linkedinUrl"
                    type="url"
                    placeholder="https://linkedin.com/..."
                    value={linkedinUrl}
                    onChange={(e) => setLinkedinUrl(e.target.value)}
                    className="pl-9 text-xs"
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="instagramUrl" className="text-xs">Instagram</Label>
                <div className="relative">
                  <Instagram className="absolute left-3 top-2.5 h-4 w-4 text-[#E1306C]" />
                  <Input
                    id="instagramUrl"
                    type="url"
                    placeholder="https://instagram.com/..."
                    value={instagramUrl}
                    onChange={(e) => setInstagramUrl(e.target.value)}
                    className="pl-9 text-xs"
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label htmlFor="facebookUrl" className="text-xs">Facebook</Label>
                <div className="relative">
                  <Facebook className="absolute left-3 top-2.5 h-4 w-4 text-[#1877F2]" />
                  <Input
                    id="facebookUrl"
                    type="url"
                    placeholder="https://facebook.com/..."
                    value={facebookUrl}
                    onChange={(e) => setFacebookUrl(e.target.value)}
                    className="pl-9 text-xs"
                    disabled={isPending}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Fila 4: Descripción | Ventajas (2 cols) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <div className="flex justify-between">
                <Label htmlFor="descripcion">Descripción de tus servicios *</Label>
                <span className={`text-xs ${descripcion.length > 300 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {descripcion.length}/300
                </span>
              </div>
              <Textarea
                id="descripcion"
                placeholder="Describe a qué se dedica tu empresa y el valor que entregas a tus clientes..."
                rows={4}
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value.slice(0, 300))}
                disabled={isPending}
              />
            </div>

            <div className="space-y-2">
              <Label>Ventajas competitivas / Diferenciadores (1 a 3)</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="ej. Garantía de resultados por contrato"
                  value={nuevaVentaja}
                  onChange={(e) => setNuevaVentaja(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      handleAddVentaja();
                    }
                  }}
                  disabled={isPending || ventajas.length >= 3}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleAddVentaja}
                  disabled={isPending || ventajas.length >= 3 || !nuevaVentaja.trim()}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  Agregar
                </Button>
              </div>
              <div className="flex flex-wrap gap-2 pt-2">
                {ventajas.map((v, index) => (
                  <Badge key={index} variant="secondary" className="text-sm py-1 px-3 flex items-center gap-1.5 bg-primary/10 text-primary border-primary/20">
                    {v}
                    <button
                      type="button"
                      onClick={() => handleRemoveVentaja(index)}
                      className="hover:text-destructive transition-colors ml-1"
                      disabled={isPending}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </Badge>
                ))}
                {ventajas.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">No has agregado ventajas.</span>
                )}
              </div>
            </div>
          </div>

          {/* Footer: Botones */}
          <div className="pt-4 flex justify-end gap-3 border-t border-border">
            {initialProfile?.onboarding_completado && (
              <Button
                type="button"
                variant="outline"
                disabled={isPending || isSaving}
                onClick={() => setIsEditing(false)}
              >
                Cancelar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isPending || isSaving}
              className="px-8 bg-primary hover:bg-primary/90 text-primary-foreground font-semibold"
            >
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Guardando...
                </>
              ) : (
                <>{initialProfile?.onboarding_completado ? "Guardar Cambios" : "Guardar"}</>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  );
}

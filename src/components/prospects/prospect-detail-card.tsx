"use client";

import React, { useState, useTransition } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ZonlixLoader } from "@/components/shared/zonlix-loader";
import { Skeleton } from "@/components/ui/skeleton";
import { ScoreBadge } from "@/components/prospects/score-badge";
import { StatusSelect } from "@/components/prospects/status-select";
import { WhatsAppButton } from "@/components/prospects/whatsapp-button";
import { ObjectionModal } from "@/components/copilot/objection-modal";
import { updateMessageContent, refetchSocialMedia, retryAudit, updateSocialMediaUrls } from "@/app/actions/prospects.actions";
import { crearSeguimiento, completarSeguimiento } from "@/app/actions/follow-ups.actions";
import {
  Globe,
  MapPin,
  Star,
  Phone,
  Copy,
  Check,
  Edit,
  Save,
  Calendar,
  Plus,
  AlertTriangle,
  ArrowLeft,
  MessageSquare,
  Mail,
  PhoneCall,
  CheckCircle2,
  Search,
  Sparkles,
  Loader2,
  RefreshCw,
} from "lucide-react";


import { toast } from "sonner";
import { formatDate } from "@/lib/utils";
import { validatePhoneType } from "@/lib/phone";
import type { ProspectRow, AuditRow, MessageRow, FollowUpRow } from "@/types";

interface ProspectDetailCardProps {
  prospect: ProspectRow;
  audit: AuditRow | null;
  messages: MessageRow[];
  followUps: FollowUpRow[];
}

export function ProspectDetailCard({
  prospect,
  audit,
  messages,
  followUps,
}: ProspectDetailCardProps) {
  const [copiedChannel, setCopiedChannel] = useState<string | null>(null);

  // Mensaje de WhatsApp actual
  const waMsgObj = messages.find((m) => m.canal === "whatsapp");
  const emailMsgObj = messages.find((m) => m.canal === "email");
  const phoneMsgObj = messages.find((m) => m.canal === "llamada");

  // Estados de edición para mensajes
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editedContent, setEditedContent] = useState<string>("");
  const [isPendingMessage, startTransitionMessage] = useTransition();

  // Estados para nuevo seguimiento
  const [fechaSeguimiento, setFechaSeguimiento] = useState("");
  const [tipoSeguimiento, setTipoSeguimiento] = useState("");
  const [isPendingFollowUp, startTransitionFollowUp] = useTransition();

  // Safety Timeout de 6 segundos si no existen mensajes guardados
  const [forceFallback, setForceFallback] = React.useState(false);

  React.useEffect(() => {
    if (messages.length === 0) {
      const timer = setTimeout(() => {
        setForceFallback(true);
      }, 6000);
      return () => clearTimeout(timer);
    }
  }, [messages.length]);

  const defaultMessages = {
    whatsapp: `Hola! Noté que ${prospect.nombre_empresa} no cuenta con sitio web ni menú/catálogo digital optimizado. Estamos ayudando a negocios locales de la zona a captar más clientes directo en WhatsApp. ¿Te interesaría ver una propuesta rápida sin compromiso?`,
    email: `Asunto: Propuesta de presencia digital para ${prospect.nombre_empresa}\n\nHola equipo de ${prospect.nombre_empresa},\n\nRevisé la presencia digital de su negocio y noté que aún no cuentan con sitio web oficial ni catálogo digital optimizado para captar clientes desde Google.\n\nEn nuestra agencia ayudamos a empresas a incrementar sus ventas con sitios web modernos y estrategias directas a WhatsApp.\n\n¿Tendrán 5 minutos esta semana para mostrarles una propuesta rápida y sin compromiso?\n\nSaludos.`,
    llamada: `1. Saludo inicial amigable y confirmar si habla con el encargado de ${prospect.nombre_empresa}.\n2. Mencionar que notaron que no tienen sitio web o catálogo digital activo.\n3. Explicar brevemente cómo ayudan a negocios de su mismo sector a recibir clientes por WhatsApp.\n4. Preguntar si tienen 5 minutos para enviarles un ejemplo visual sin compromiso.`,
  };

  const currentWaContent = waMsgObj?.contenido || (forceFallback || !prospect.sitio_web ? defaultMessages.whatsapp : null);
  const currentEmailContent = emailMsgObj?.contenido || (forceFallback || !prospect.sitio_web ? defaultMessages.email : null);
  const currentPhoneContent = phoneMsgObj?.contenido || (forceFallback || !prospect.sitio_web ? defaultMessages.llamada : null);

  const [socialSearchEmpty, setSocialSearchEmpty] = useState(false);
  const [isPendingSocial, startTransitionSocial] = useTransition();

  const handleRefetchSocial = () => {
    startTransitionSocial(async () => {
      const res = await refetchSocialMedia(prospect.id);
      if (res.success && res.data) {
        if (res.data.facebook_url || res.data.instagram_url) {
          toast.success("Redes sociales encontradas y vinculadas.");
          setSocialSearchEmpty(false);
        } else {
          toast.info("No se hallaron redes sociales para esta empresa.");
          setSocialSearchEmpty(true);
        }
      } else {
        toast.error(res.error || "Error al buscar redes sociales");
      }
    });
  };

  const [isPendingAudit, startTransitionAudit] = useTransition();

  const handleRetryAudit = () => {
    startTransitionAudit(async () => {
      const res = await retryAudit(prospect.id);
      if (res.success) {
        toast.success("Auditoría generada con éxito.");
      } else {
        toast.error(res.error || "Error al reintentar auditoría.");
      }
    });
  };

  const [isEditingSocials, setIsEditingSocials] = useState(false);
  const [fbInput, setFbInput] = useState(prospect.facebook_url || "");
  const [igInput, setIgInput] = useState(prospect.instagram_url || "");
  const [isSavingSocials, startTransitionSavingSocials] = useTransition();

  const handleSaveSocials = () => {
    startTransitionSavingSocials(async () => {
      const res = await updateSocialMediaUrls(prospect.id, fbInput, igInput);
      if (res.success) {
        toast.success("Redes sociales actualizadas");
        setIsEditingSocials(false);
      } else {
        toast.error(res.error || "Error al actualizar redes sociales");
      }
    });
  };



  const handleCopy = (text: string, canal: string) => {
    navigator.clipboard.writeText(text);
    setCopiedChannel(canal);
    toast.success(`Mensaje de ${canal} copiado al portapapeles`);
    setTimeout(() => setCopiedChannel(null), 2000);
  };

  const handleStartEdit = (canal: string, currentText: string) => {
    setEditingChannel(canal);
    setEditedContent(currentText);
  };

  const handleSaveEdit = (messageId?: string) => {
    if (!messageId) return;

    startTransitionMessage(async () => {
      const result = await updateMessageContent(messageId, editedContent);
      if (result.success) {
        toast.success("Mensaje actualizado correctamente");
        setEditingChannel(null);
      } else {
        toast.error(result.error ?? "No se pudo actualizar el mensaje");
      }
    });
  };

  const handleCrearSeguimiento = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fechaSeguimiento) {
      toast.error("Selecciona una fecha para el seguimiento");
      return;
    }

    startTransitionFollowUp(async () => {
      const result = await crearSeguimiento(
        prospect.id,
        fechaSeguimiento,
        tipoSeguimiento || "Llamada / Mensaje"
      );
      if (result.success) {
        toast.success("Seguimiento agendado");
        setFechaSeguimiento("");
        setTipoSeguimiento("");
      } else {
        toast.error(result.error ?? "Error al agendar seguimiento");
      }
    });
  };

  const handleCompletarSeguimiento = (id: string) => {
    startTransitionFollowUp(async () => {
      const result = await completarSeguimiento(id);
      if (result.success) {
        toast.success("Seguimiento marcado como realizado");
      } else {
        toast.error(result.error ?? "Error al completar seguimiento");
      }
    });
  };

  const puntosDolorList = Array.isArray(audit?.puntos_dolor)
    ? (audit.puntos_dolor as string[])
    : [];

  const phoneType = validatePhoneType(prospect.whatsapp || prospect.telefono);
  const defaultTab = phoneType === 'MOBILE' ? 'whatsapp' : 'llamada';

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Novedoso con Navegación */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <Link
            href="/prospectos"
            className="inline-flex items-center text-xs font-semibold text-muted-foreground hover:text-foreground mb-2 transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5 mr-1" />
            Volver a la lista de prospectos
          </Link>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">
            {prospect.nombre_empresa}
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <StatusSelect prospectId={prospect.id} currentStatus={prospect.status} />
          <WhatsAppButton prospect={prospect} message={waMsgObj?.contenido} />
        </div>
      </div>

      {/* Grid Principal: Info General + Audit Card */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Info General */}
      <Card className="bg-white border border-neutral-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base font-semibold">Información General</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-xs">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Globe className="w-4 h-4 text-primary shrink-0" />
              {prospect.sitio_web ? (
                <a
                  href={prospect.sitio_web}
                  target="_blank"
                  rel="noreferrer"
                  className="hover:underline text-foreground truncate"
                >
                  {prospect.sitio_web}
                </a>
              ) : (
                <span className="italic">Sin sitio web</span>
              )}
            </div>

            <div className="flex items-center gap-2 text-muted-foreground flex-wrap">
              <Phone className="w-4 h-4 text-primary shrink-0" />
              <span className="text-foreground">{prospect.whatsapp || prospect.telefono || "No disponible"}</span>
              {phoneType === 'MOBILE' ? (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20 font-medium">
                  WhatsApp disponible
                </Badge>
              ) : phoneType !== 'UNKNOWN' ? (
                <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-600 border-blue-500/20 font-medium">
                  Línea fija / Oficina
                </Badge>
              ) : null}
            </div>

            <div className="flex items-start gap-2 text-muted-foreground">
              <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span className="text-foreground">{prospect.direccion || "Dirección no especificada"}</span>
            </div>

            <div className="flex items-center gap-2 text-muted-foreground">
              <Star className="w-4 h-4 fill-amber-400 text-amber-400 shrink-0" />
              <span className="text-foreground font-medium">
                {prospect.calificacion_google ? `${prospect.calificacion_google} / 5` : "Sin calificación"}
              </span>
              {prospect.num_resenas !== null && (
                <span>({prospect.num_resenas} reseñas)</span>
              )}
            </div>

            {/* Redes Sociales / Fallback Búsqueda Google */}
            {(() => {
              const hasFacebook = Boolean(prospect.facebook_url && prospect.facebook_url.trim());
              const hasInstagram = Boolean(prospect.instagram_url && prospect.instagram_url.trim());

              return (
                <div className="pt-3 border-t border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                      Redes Sociales
                    </span>
                    {!isEditingSocials && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-6 text-[10px] px-2 text-muted-foreground hover:text-primary"
                        onClick={() => setIsEditingSocials(true)}
                      >
                        {!hasFacebook && !hasInstagram ? (
                          <><Plus className="w-3 h-3 mr-1" /> Agregar redes</>
                        ) : (
                          <><Edit className="w-3 h-3 mr-1" /> Editar redes</>
                        )}
                      </Button>
                    )}
                  </div>
                  
                  {isEditingSocials ? (
                    <div className="flex flex-col gap-2 bg-muted/20 p-2 rounded-md border border-border">
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Facebook URL</Label>
                        <Input 
                          placeholder="https://facebook.com/..." 
                          value={fbInput} 
                          onChange={(e) => setFbInput(e.target.value)} 
                          className="h-7 text-xs" 
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px] text-muted-foreground">Instagram URL</Label>
                        <Input 
                          placeholder="https://instagram.com/..." 
                          value={igInput} 
                          onChange={(e) => setIgInput(e.target.value)} 
                          className="h-7 text-xs" 
                        />
                      </div>
                      <div className="flex justify-end gap-2 mt-1">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-6 text-[10px] px-2" 
                          onClick={() => setIsEditingSocials(false)}
                          disabled={isSavingSocials}
                        >
                          Cancelar
                        </Button>
                        <Button 
                          size="sm" 
                          className="h-6 text-[10px] px-2" 
                          onClick={handleSaveSocials}
                          disabled={isSavingSocials}
                        >
                          {isSavingSocials ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Save className="w-3 h-3 mr-1" />} Guardar
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      {hasFacebook && (
                        <a
                          href={prospect.facebook_url!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-blue-600/10 text-blue-500 hover:bg-blue-600/20 font-semibold transition-colors"
                        >
                          Facebook
                        </a>
                      )}
                      {hasInstagram && (
                        <a
                          href={prospect.instagram_url!}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs bg-pink-600/10 text-pink-500 hover:bg-pink-600/20 font-semibold transition-colors"
                        >
                          Instagram
                        </a>
                      )}
                      {!hasFacebook && !hasInstagram && (
                        <>
                          {socialSearchEmpty ? (
                            <span className="text-[11px] text-muted-foreground italic px-1">
                              No se detectaron redes sociales públicas.
                            </span>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={handleRefetchSocial}
                              disabled={isPendingSocial}
                              className="text-xs h-7 gap-1.5 font-medium border-primary/30 hover:border-primary text-primary"
                            >
                              {isPendingSocial ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  Buscando...
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Buscar redes con IA
                                </>
                              )}
                            </Button>
                          )}
                          <a
                            href={`https://www.google.com/search?q=${encodeURIComponent(`${prospect.nombre_empresa} ${prospect.direccion || ""} instagram facebook`)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs border border-border bg-muted/30 hover:bg-muted/60 text-muted-foreground hover:text-foreground font-medium transition-colors"
                          >
                            <Search className="w-3.5 h-3.5" />
                            Buscar en Google
                          </a>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

          </CardContent>

        </Card>

        {/* Auditoría IA */}
        <Card className={`bg-card md:col-span-2 border transition-all ${
          audit?.tier === 'verde' ? 'border-score-alto/40 shadow-sm shadow-score-alto/10' :
          audit?.tier === 'amarillo' ? 'border-score-medio/40 shadow-sm shadow-score-medio/10' :
          audit?.tier === 'rojo' ? 'border-score-bajo/40 shadow-sm shadow-score-bajo/10' :
          'border-border'
        }`}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base font-semibold">Auditoría de Presencia Digital</CardTitle>
              <CardDescription className="text-xs">Generada automáticamente por IA</CardDescription>
            </div>
            <ScoreBadge score={audit?.score} tier={audit?.tier} showOpportunityLabel />
          </CardHeader>
          <CardContent className="space-y-4 pt-2">
            <div>
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">
                Resumen Ejecutivo
              </h4>
              <div className="flex flex-col gap-2">
                <p className="text-xs text-foreground bg-muted/30 p-3 rounded-lg border border-border">
                  {audit?.resumen_ia ?? "Auditoría en pausa por límite de procesamiento."}
                </p>
                {(!audit || audit.resumen_ia?.toLowerCase().includes("cuota") || audit.resumen_ia?.toLowerCase().includes("límite")) && (
                  <div className="flex flex-col gap-1.5 mt-1">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      disabled={isPendingAudit} 
                      onClick={handleRetryAudit}
                      className="self-start text-xs h-8 border-primary/40 hover:bg-primary/10 text-primary"
                    >
                      {isPendingAudit ? (
                        <ZonlixLoader size={16} inline text="Auditando con IA..." />
                      ) : (
                        <><RefreshCw className="w-3.5 h-3.5 mr-1.5" /> ⚡ Reintentar Auditoría con IA</>
                      )}
                    </Button>
                    <span className="text-[10px] text-muted-foreground italic px-1">
                      Has alcanzado el límite de consultas por minuto. Espera 1 minuto y haz clic en 'Reintentar Auditoría'.
                    </span>
                  </div>
                )}
              </div>
            </div>

            {puntosDolorList.length > 0 && (
              <div>
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2">
                  Puntos de Dolor Detectados
                </h4>
                <ul className="space-y-1.5">
                  {puntosDolorList.map((punto, idx) => (
                    <li key={idx} className="flex items-start gap-2 text-xs text-foreground">
                      <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                      <span>{punto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tabs de Mensajes Generados */}
      <Card className="bg-white border border-neutral-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-bold">Mensajes de Prospección Personalizados</CardTitle>
            <CardDescription className="text-xs">
              Copywriting generado usando la fórmula: Gancho → Punto de dolor → Solución → CTA suave.
            </CardDescription>
          </div>
          <ObjectionModal prospect={prospect} />
        </CardHeader>
        <CardContent>
          <Tabs defaultValue={defaultTab} className="w-full">
            <TabsList className="grid grid-cols-3 w-full sm:w-[400px]">
              <TabsTrigger value="whatsapp" className="text-xs flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5" />
                WhatsApp
              </TabsTrigger>
              <TabsTrigger value="email" className="text-xs flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" />
                Email
              </TabsTrigger>
              <TabsTrigger value="llamada" className="text-xs flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5" />
                Guion Telefónico
              </TabsTrigger>
            </TabsList>

            {/* TAB WHATSAPP */}
            <TabsContent value="whatsapp" className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Mensaje para WhatsApp (Corto)</span>
                  <div className="flex items-center gap-2">
                    {editingChannel === "whatsapp" ? (
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(waMsgObj?.id)}
                        disabled={isPendingMessage}
                        className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Guardar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit("whatsapp", currentWaContent ?? "")}
                        className="h-8 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(currentWaContent ?? "", "whatsapp")}
                      className="h-8 text-xs"
                    >
                      {copiedChannel === "whatsapp" ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {editingChannel === "whatsapp" ? (
                  <Textarea
                    rows={4}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="text-xs font-mono"
                  />
                ) : (
                  <p className="text-xs text-foreground bg-muted/20 p-4 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                    {currentWaContent ?? "Generando mensaje..."}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* TAB EMAIL */}
            <TabsContent value="email" className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Email de Prospección</span>
                  <div className="flex items-center gap-2">
                    {editingChannel === "email" ? (
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(emailMsgObj?.id)}
                        disabled={isPendingMessage}
                        className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Guardar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit("email", currentEmailContent ?? "")}
                        className="h-8 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(currentEmailContent ?? "", "email")}
                      className="h-8 text-xs"
                    >
                      {copiedChannel === "email" ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {editingChannel === "email" ? (
                  <Textarea
                    rows={6}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="text-xs font-mono"
                  />
                ) : (
                  <p className="text-xs text-foreground bg-muted/20 p-4 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                    {currentEmailContent ?? "Generando email..."}
                  </p>
                )}
              </div>
            </TabsContent>

            {/* TAB GUION TELEFÓNICO */}
            <TabsContent value="llamada" className="pt-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-muted-foreground">Puntos clave para llamada</span>
                  <div className="flex items-center gap-2">
                    {editingChannel === "llamada" ? (
                      <Button
                        size="sm"
                        onClick={() => handleSaveEdit(phoneMsgObj?.id)}
                        disabled={isPendingMessage}
                        className="h-8 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        <Save className="w-3.5 h-3.5 mr-1" />
                        Guardar
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleStartEdit("llamada", currentPhoneContent ?? "")}
                        className="h-8 text-xs"
                      >
                        <Edit className="w-3.5 h-3.5 mr-1" />
                        Editar
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => handleCopy(currentPhoneContent ?? "", "llamada")}
                      className="h-8 text-xs"
                    >
                      {copiedChannel === "llamada" ? (
                        <>
                          <Check className="w-3.5 h-3.5 mr-1 text-emerald-400" />
                          Copiado
                        </>
                      ) : (
                        <>
                          <Copy className="w-3.5 h-3.5 mr-1" />
                          Copiar
                        </>
                      )}
                    </Button>
                  </div>
                </div>

                {editingChannel === "llamada" ? (
                  <Textarea
                    rows={6}
                    value={editedContent}
                    onChange={(e) => setEditedContent(e.target.value)}
                    className="text-xs font-mono"
                  />
                ) : (
                  <p className="text-xs text-foreground bg-muted/20 p-4 rounded-lg border border-border whitespace-pre-wrap leading-relaxed">
                    {currentPhoneContent ?? "Generando guion..."}
                  </p>
                )}
              </div>
            </TabsContent>

          </Tabs>
        </CardContent>
      </Card>

      {/* Sección de Seguimientos (`follow_ups`) */}
      <Card className="bg-white border border-neutral-200/80 shadow-[0_2px_10px_rgba(0,0,0,0.03)] rounded-2xl">
        <CardHeader>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Calendar className="w-4 h-4 text-primary" />
            Programar Seguimiento
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <form onSubmit={handleCrearSeguimiento} className="flex flex-col sm:flex-row gap-3">
            <div className="space-y-1 flex-1">
              <Label htmlFor="fecha" className="text-xs">Fecha de vencimiento *</Label>
              <Input
                id="fecha"
                type="date"
                value={fechaSeguimiento}
                onChange={(e) => setFechaSeguimiento(e.target.value)}
                disabled={isPendingFollowUp}
                className="h-9 text-xs"
              />
            </div>
            <div className="space-y-1 flex-1">
              <Label htmlFor="tipo" className="text-xs">Tipo de tarea</Label>
              <Input
                id="tipo"
                placeholder="ej. Enviar propuesta, Llamada de cierre..."
                value={tipoSeguimiento}
                onChange={(e) => setTipoSeguimiento(e.target.value)}
                disabled={isPendingFollowUp}
                className="h-9 text-xs"
              />
            </div>
            <div className="flex items-end">
              <Button
                type="submit"
                disabled={isPendingFollowUp || !fechaSeguimiento}
                size="sm"
                className="h-9 text-xs bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Plus className="w-3.5 h-3.5 mr-1" />
                Agendar
              </Button>
            </div>
          </form>

          {/* Historial de seguimientos */}
          {followUps.length > 0 ? (
            <div className="space-y-2 pt-2 border-t border-border">
              <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                Seguimientos Registrados
              </h4>
              <div className="space-y-1.5">
                {followUps.map((fu) => (
                  <div
                    key={fu.id}
                    className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-muted/20 text-xs"
                  >
                    <div className="flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
                      <span className="font-medium text-foreground">{formatDate(fu.fecha_vencimiento)}</span>
                      <span className="text-muted-foreground">• {fu.tipo ?? "Seguimiento"}</span>
                    </div>

                    {fu.completado ? (
                      <span className="inline-flex items-center text-emerald-400 text-xs font-medium">
                        <CheckCircle2 className="w-3.5 h-3.5 mr-1" />
                        Completado
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCompletarSeguimiento(fu.id)}
                        disabled={isPendingFollowUp}
                        className="h-7 text-xs"
                      >
                        Marcar hecho
                      </Button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic pt-2">No hay seguimientos pendientes agendados.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

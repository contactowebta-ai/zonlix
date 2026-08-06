"use client";

import React, { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { motion } from "framer-motion";
import { Save, User, Key, Palette, Bell, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";

import { useTheme } from "next-themes";

export default function ConfiguracionPage() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  
  const [userEmail, setUserEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [originalName, setOriginalName] = useState("");
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingPrefs, setIsFetchingPrefs] = useState(true);
  const [showSuccessToast, setShowSuccessToast] = useState(false);
  const [emailAlerts, setEmailAlerts] = useState(false);
  const [systemUpdates, setSystemUpdates] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    setMounted(true);
    const fetchUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data?.user) {
          setAuthError(true);
          setUserEmail("");
          setFullName("");
        } else {
          setUserEmail(data.user.email ?? "");
          const fetchedName = data.user.user_metadata?.full_name ?? "";
          setFullName(fetchedName);
          setOriginalName(fetchedName);
          
          setEmailAlerts(data.user.user_metadata?.extraction_alerts ?? false);
          setSystemUpdates(data.user.user_metadata?.system_updates ?? false);
        }
      } catch (e) {
        setAuthError(true);
      } finally {
        setIsAuthLoading(false);
        setIsFetchingPrefs(false);
      }
    };
    fetchUser();
  }, [supabase]);

  const handleUpdateProfile = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (fullName === originalName) return;
    setIsSaving(true);
    setShowSuccessToast(false);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { full_name: fullName }
      });
      if (error) throw error;
      setOriginalName(fullName);
      setShowSuccessToast(true);
      toast.success("¡Perfil actualizado correctamente!");
    } catch (error: any) {
      toast.error(error.message || "No se pudo actualizar el perfil");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleEmailAlerts = async () => {
    const newStatus = !emailAlerts;
    setEmailAlerts(newStatus);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { extraction_alerts: newStatus }
      });
      if (error) throw error;
    } catch (e: any) {
      setEmailAlerts(!newStatus);
      toast.error("No se pudo guardar la preferencia");
    }
  };

  const handleToggleSystemUpdates = async () => {
    const newStatus = !systemUpdates;
    setSystemUpdates(newStatus);
    try {
      const { error } = await supabase.auth.updateUser({
        data: { system_updates: newStatus }
      });
      if (error) throw error;
    } catch (e: any) {
      setSystemUpdates(!newStatus);
      toast.error("No se pudo guardar la preferencia");
    }
  };

  const handleSaveWebhook = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success("Configuración guardada exitosamente");
  };

  if (!mounted) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-8 p-4">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Configuración</h1>
        <p className="text-muted-foreground">Administra tus preferencias, integraciones y detalles de cuenta.</p>
      </div>

      <Tabs defaultValue="cuenta" className="w-full">
        <TabsList className="grid w-full grid-cols-3 mb-8 h-12">
          <TabsTrigger value="cuenta" className="h-10 text-sm gap-2">
            <User className="w-4 h-4" />
            Perfil / Cuenta
          </TabsTrigger>
          <TabsTrigger value="integraciones" className="h-10 text-sm gap-2">
            <Key className="w-4 h-4" />
            Integraciones
          </TabsTrigger>
          <TabsTrigger value="apariencia" className="h-10 text-sm gap-2">
            <Palette className="w-4 h-4" />
            Apariencia
          </TabsTrigger>
        </TabsList>

        <AnimateTabContent value="cuenta">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#151D2A] mb-6">
            <CardHeader>
              <CardTitle>Perfil de Usuario</CardTitle>
              <CardDescription>
                Actualiza tu información personal y correo asociado a la cuenta.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpdateProfile} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre completo</Label>
                    {isAuthLoading ? (
                      <div className="animate-pulse bg-slate-200 dark:bg-slate-800 h-10 rounded-xl" />
                    ) : (
                      <Input id="name" value={fullName} onChange={(e) => setFullName(e.target.value)} className="bg-slate-50 dark:bg-[#0F1622] border-slate-200 dark:border-slate-800" disabled={isSaving} />
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email">Correo electrónico</Label>
                    {isAuthLoading ? (
                      <div className="animate-pulse bg-slate-200 dark:bg-slate-800 h-10 rounded-xl" />
                    ) : (
                      <>
                        <Input id="email" type="email" value={userEmail} readOnly disabled className="bg-slate-100 dark:bg-slate-900/50 text-slate-600 dark:text-slate-400 cursor-not-allowed border-slate-200 dark:border-slate-800" />
                        {authError ? (
                          <p className="text-[10px] text-destructive">No se pudo obtener el correo de la sesión.</p>
                        ) : (
                          <p className="text-[10px] text-muted-foreground">El correo no puede ser modificado.</p>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <Button type="button" onClick={() => handleUpdateProfile()} className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                  {isSaving ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
                  {isSaving ? "Guardando..." : "Actualizar Perfil"}
                </Button>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#151D2A]">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-slate-500" />
                Preferencias de Notificaciones
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl mb-3">
                <div className="flex-1 pr-4 space-y-0.5">
                  <Label className="text-sm font-medium">ALERTAS DE EXTRACCIÓN Y AUDITORÍA</Label>
                  <p className="text-xs text-muted-foreground">Recibe un correo cuando Zonlix termine de extraer y analizar un lote nuevo de prospectos.</p>
                </div>
                {isFetchingPrefs ? (
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleEmailAlerts}
                    disabled={isAuthLoading}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      emailAlerts ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        emailAlerts ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                )}
              </div>
              <div className="flex items-center justify-between p-4 bg-slate-50 dark:bg-[#151D2A] border border-slate-200 dark:border-slate-800 rounded-xl mb-3">
                <div className="flex-1 pr-4 space-y-0.5">
                  <Label className="text-sm font-medium">NOVEDADES Y ACTUALIZACIONES</Label>
                  <p className="text-xs text-muted-foreground">Notificaciones sobre mejoras en los modelos de IA y nuevas herramientas.</p>
                </div>
                {isFetchingPrefs ? (
                  <div className="w-11 h-6 bg-slate-200 dark:bg-slate-800 animate-pulse rounded-full" />
                ) : (
                  <button
                    type="button"
                    onClick={handleToggleSystemUpdates}
                    disabled={isAuthLoading}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 ${
                      systemUpdates ? "bg-emerald-500" : "bg-slate-300 dark:bg-slate-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                        systemUpdates ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </AnimateTabContent>

        <AnimateTabContent value="integraciones">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#151D2A] mb-6">
            <CardHeader>
              <CardTitle>Webhook Outbound (Zapier / Make / GoHighLevel)</CardTitle>
              <CardDescription>
                Conecta Zonlix con tu CRM o flujos de trabajo enviando los datos de tus prospectos a una URL personalizada.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSaveWebhook} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="webhook-url">URL del Webhook</Label>
                  <Input id="webhook-url" type="url" placeholder="https://hooks.zapier.com/..." className="font-mono bg-slate-50 dark:bg-[#0F1622] border-slate-200 dark:border-slate-800" />
                  <p className="text-xs text-muted-foreground">Enviaremos un payload JSON cada vez que un prospecto avance a "Propuesta Enviada".</p>
                </div>
                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <Button type="button" variant="outline" className="w-full sm:w-auto" onClick={() => toast.success("Webhook de prueba enviado")}>
                    Probar Envío
                  </Button>
                  <Button type="submit" className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white border-0">
                    <Save className="w-4 h-4 mr-2" />
                    Guardar Configuración
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#151D2A]">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <div>
                <CardTitle>Conexión de WhatsApp / CRM</CardTitle>
                <CardDescription className="mt-1.5">
                  Sincroniza tus chats de WhatsApp y actualiza el CRM automáticamente.
                </CardDescription>
              </div>
              <span className="bg-blue-50 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400 text-xs font-semibold px-2.5 py-1 rounded-full border border-blue-200 dark:border-blue-500/30">
                Próximamente
              </span>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                Estamos trabajando para integrarnos de forma nativa con los principales proveedores de WhatsApp API oficiales.
              </p>
            </CardContent>
          </Card>
        </AnimateTabContent>

        <AnimateTabContent value="apariencia">
          <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-white dark:bg-[#151D2A]">
            <CardHeader>
              <CardTitle>Tema de la Aplicación</CardTitle>
              <CardDescription>
                Personaliza cómo se ve Zonlix en tu dispositivo.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 gap-4">
                <button
                  type="button"
                  onClick={() => setTheme("light")}
                  className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all ${
                    theme === "light"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1622] hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="w-full h-20 bg-slate-100 rounded-md mb-3 flex items-center justify-center border border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-white shadow-sm" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Claro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("dark")}
                  className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all ${
                    theme === "dark"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1622] hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="w-full h-20 bg-slate-900 rounded-md mb-3 flex items-center justify-center border border-slate-800">
                    <div className="w-8 h-8 rounded-full bg-slate-800 shadow-sm" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Oscuro</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTheme("system")}
                  className={`flex flex-col items-center justify-between rounded-md border-2 p-4 cursor-pointer transition-all ${
                    theme === "system"
                      ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-500/10"
                      : "border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-[#0F1622] hover:border-slate-300 dark:hover:border-slate-700"
                  }`}
                >
                  <div className="w-full h-20 bg-gradient-to-r from-slate-100 to-slate-900 rounded-md mb-3 flex items-center justify-center border border-slate-200">
                    <div className="w-8 h-8 rounded-full bg-gradient-to-r from-white to-slate-800 shadow-sm" />
                  </div>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Sistema</span>
                </button>
              </div>
            </CardContent>
          </Card>
        </AnimateTabContent>
      </Tabs>
    </div>
  );
}

function AnimateTabContent({ value, children }: { value: string; children: React.ReactNode }) {
  return (
    <TabsContent value={value}>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        transition={{ duration: 0.2 }}
      >
        {children}
      </motion.div>
    </TabsContent>
  );
}

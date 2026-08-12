"use client";

/**
 * src/app/(auth)/login/page.tsx
 *
 * Página de autenticación (Login / Signup) usando Supabase Client Auth.
 */
import React, { useState, useTransition, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Mail, Lock, LogIn, UserPlus, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { ZonlixLogo } from "@/components/shared/zonlix-logo";
import { ZonlixLoader } from "@/components/shared/zonlix-loader";
import { getAuthErrorMessage } from "@/lib/auth-errors";

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultTab = searchParams.get("tab") === "signup" ? "signup" : "login";

  const [activeTab, setActiveTab] = useState(defaultTab);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isPending, startTransition] = useTransition();
  // Error inline para feedback visual dentro del card (complementa el toast)
  const [authError, setAuthError] = useState<string | null>(null);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password) {
      const msg = "Por favor completa todos los campos";
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = getAuthErrorMessage(error);
          setAuthError(msg);
          toast.error(msg);
          return;
        }

        // Login exitoso — limpiar error y redirigir
        setAuthError(null);
        toast.success("¡Sesión iniciada con éxito!");

        // Redirección condicional según estado de onboarding
        let destination = "/onboarding"; // fallback seguro
        if (data?.user?.id) {
          const { data: profileData } = await (supabase.from("profiles") as any)
            .select("onboarding_completado")
            .eq("id", data.user.id)
            .maybeSingle();
          if (profileData?.onboarding_completado === true) {
            destination = "/buscar";
          }
        }

        router.push(destination);
        router.refresh();
      } catch (err) {
        const msg = getAuthErrorMessage(err);
        setAuthError(msg);
        toast.error(msg);
      }
    });
  };

  const handleSignUp = (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);

    if (!email.trim() || !password) {
      const msg = "Por favor completa todos los campos";
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    if (password.length < 6) {
      const msg = "La contraseña debe tener al menos 6 caracteres";
      setAuthError(msg);
      toast.error(msg);
      return;
    }

    startTransition(async () => {
      try {
        const supabase = createClient();
        const { error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
        });

        if (error) {
          const msg = getAuthErrorMessage(error);
          setAuthError(msg);
          toast.error(msg);
          return;
        }

        setAuthError(null);
        toast.success("¡Cuenta creada exitosamente! Redirigiendo...");
        router.push("/onboarding");
        router.refresh();
      } catch (err) {
        const msg = getAuthErrorMessage(err);
        setAuthError(msg);
        toast.error(msg);
      }
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md space-y-6">

        {/* Branding Header — ZonlixLogo reemplaza Sparkles + h1 duplicado */}
        <div className="text-center space-y-2 flex flex-col items-center">
          {/* variant="dark" → text-slate-900 dark:text-white, igual que el h1 original con text-foreground */}
          <ZonlixLogo
            size="lg"
            variant="dark"
            showText={true}
            glow={true}
          />
          <p className="text-sm text-muted-foreground">
            Plataforma B2B de prospección y auditoría con IA
          </p>
        </div>

        {/* Auth Card — vidrio-oscuro en dark mode, legible en light */}
        <Card className="bg-white dark:bg-zinc-900/95 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl">
          <CardHeader className="text-center pb-4">
            <CardTitle className="text-xl font-semibold">Bienvenido</CardTitle>
            <CardDescription className="text-xs">
              Ingresa tus credenciales o crea una cuenta nueva para comenzar
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs
              value={activeTab}
              onValueChange={(val) => { setActiveTab(val ?? "login"); setAuthError(null); }}
              className="w-full"
            >
              <TabsList className="grid grid-cols-2 w-full mb-6">
                <TabsTrigger value="login" className="text-xs flex items-center gap-1.5">
                  <LogIn className="w-3.5 h-3.5" />
                  Iniciar Sesión
                </TabsTrigger>
                <TabsTrigger value="signup" className="text-xs flex items-center gap-1.5">
                  <UserPlus className="w-3.5 h-3.5" />
                  Registrarse
                </TabsTrigger>
              </TabsList>

              {/* INICIAR SESIÓN */}
              <TabsContent value="login">
                <form onSubmit={handleLogin} noValidate className="space-y-4">
                  {/* Banner de error inline — visible cuando hay error de auth/validación */}
                  {authError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2 animate-in fade-in-0 duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{authError}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Correo Electrónico</Label>
                    {/* group permite group-focus-within en el ícono si se desea en el futuro */}
                    <div className="relative group">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="tu@empresa.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                        className="pl-9 text-xs focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Contraseña</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isPending}
                        className="pl-9 text-xs focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 mt-2"
                  >
                    {isPending ? (
                      <ZonlixLoader variant="button" inline size={16} text="Iniciando sesión..." />
                    ) : (
                      <>
                        <LogIn className="w-4 h-4 mr-2" />
                        Entrar a Zonlix
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>

              {/* REGISTRARSE */}
              <TabsContent value="signup">
                <form onSubmit={handleSignUp} noValidate className="space-y-4">
                  {/* Banner de error inline */}
                  {authError && (
                    <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-xs font-medium flex items-center gap-2 animate-in fade-in-0 duration-200">
                      <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                      <span>{authError}</span>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Correo Electrónico Corporativo</Label>
                    <div className="relative group">
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="tu@agencia.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        disabled={isPending}
                        className="pl-9 text-xs focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Contraseña (Mínimo 6 caracteres)</Label>
                    <div className="relative group">
                      <Lock className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        disabled={isPending}
                        className="pl-9 text-xs focus:border-emerald-500 focus:ring-emerald-500"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isPending}
                    className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold h-10 mt-2"
                  >
                    {isPending ? (
                      <ZonlixLoader variant="button" inline size={16} text="Creando cuenta..." />
                    ) : (
                      <>
                        <UserPlus className="w-4 h-4 mr-2" />
                        Crear Cuenta Gratis
                      </>
                    )}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      // ZonlixLoader: consistencia total de marca — el Suspense se dispara antes de que cualquier
      // componente cliente esté listo, pero ZonlixLoader ya es server-safe porque solo depende
      // de framer-motion que está lazy-loaded; usar ZonlixLoader aquí es preferible a Loader2
      // ya que ambos son client components, y mantiene 100% de identidad visual de marca.
      <div className="flex min-h-screen items-center justify-center bg-background">
        <ZonlixLoader size={48} />
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}

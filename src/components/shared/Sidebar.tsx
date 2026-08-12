"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { ZonlixLogo } from "@/components/shared/zonlix-logo";
import { LogOut, User as UserIcon, Search, Building2, BarChart3, Kanban, Settings, Coins, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";

const navItems = [
  { href: "/onboarding", label: "Perfil", icon: UserIcon },
  { href: "/buscar", label: "Buscar", icon: Search },
  { href: "/prospectos", label: "Prospectos", icon: Building2 },
  { href: "/resultados", label: "Resultados", icon: BarChart3 },
  { href: "/crm", label: "CRM", icon: Kanban },
  { href: "/configuracion", label: "Configuración", icon: Settings },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [credits, setCredits] = useState<number | null>(null);
  const [fullName, setFullName] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.id) {
          if (isMounted) setCredits(0);
          return;
        }

        if (isMounted) {
          setUser(user);
          const userMetaName = user.user_metadata?.full_name || user.user_metadata?.name || user.email?.split('@')[0] || 'Usuario';
          setFullName(userMetaName);
        }

        // Fetch inicial de créditos
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("credits_remaining")
          .eq("id", user.id)
          .maybeSingle();

        if (error) {
          console.error('[Sidebar] Error de Supabase:', error.message);
        } else if (isMounted && profile) {
          setCredits((profile as any).credits_remaining ?? 0);
        }

      // Canal único por usuario — evita colisiones entre montajes
      channel = supabase
        .channel(`credits-update-${user.id}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
          (payload) => {
            if (isMounted && payload.new && "credits_remaining" in payload.new) {
              setCredits(payload.new.credits_remaining as number);
            }
          }
        )
        .subscribe();
      } catch (err) {
        console.error('[Sidebar] Error inesperado:', err);
      }
    };

    setupRealtime();

    return () => {
      isMounted = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  const handleSignOut = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  };

  const userEmail = user?.email || "";
  const userInitial = user?.user_metadata?.full_name?.charAt(0)?.toUpperCase() 
    || user?.email?.charAt(0)?.toUpperCase() 
    || 'T';

  return (
    <aside className="w-64 min-h-screen bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 border-r border-slate-200 dark:border-slate-800 p-4 flex flex-col justify-between font-sans select-none">
      <div>
        {/* Logo */}
        <div className="mb-8 px-2 flex items-center justify-between">
          <div className="flex items-center">
            <ZonlixLogo size="md" className="text-slate-900 dark:text-white" />
            <span className="text-[10px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-md font-semibold tracking-wider ml-1.5 uppercase">beta</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold text-xs shrink-0">
            {userInitial}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex flex-col gap-1 mt-6">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                id={`nav-${item.href.replace("/", "")}`}
                className={cn(
                  "relative flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all",
                  isActive
                    ? "font-semibold text-slate-900 dark:text-white"
                    : "font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800/50"
                )}
              >
                {isActive && (
                  <motion.div
                    layoutId="sidebar-active-pill"
                    className="absolute inset-0 bg-slate-100 dark:bg-slate-800 shadow-xs rounded-xl"
                    transition={{ type: "spring", stiffness: 380, damping: 30 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-3">
                  <Icon className="h-4 w-4" />
                  {item.label}
                </span>
              </Link>
            );
          })}
        </nav>
      </div>

      <div className="mt-auto flex flex-col gap-4">
        {/* Widget de Créditos */}
        <div className="mx-2 p-3 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-xl flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-emerald-700 dark:text-emerald-400 font-medium text-sm">
              <Coins className="w-4 h-4" />
              Créditos
            </div>
            <span className="text-xs font-bold bg-white dark:bg-[#0B0F17] text-emerald-700 dark:text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-100 dark:border-emerald-500/20 shadow-sm flex items-center justify-center min-w-[32px] min-h-[24px]">
              {credits === null ? <Loader2 className="w-3 h-3 animate-spin text-emerald-500" /> : credits}
            </span>
          </div>
          <p className="text-[10px] text-emerald-600/80 dark:text-emerald-400/70 leading-tight">
            Consultas restantes en tu plan actual.
          </p>
        </div>

        {/* Footer */}
        <div className="pt-4 border-t border-border flex items-center justify-between">
        <div className="group/footer flex flex-1 items-center justify-between p-2 rounded-xl hover:bg-muted transition-colors">
          <div className="flex items-center gap-2 truncate">
            <div className="w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400 font-semibold text-xs shrink-0">
              {userInitial}
            </div>
            <div className="flex flex-col truncate">
              <span className="text-xs font-medium text-foreground truncate max-w-[110px]">
                {userEmail.split("@")[0]}
              </span>
              <span className="text-[10px] text-muted-foreground truncate max-w-[110px]">
                {userEmail}
              </span>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            title="Cerrar Sesión"
            className="h-4 w-4 text-muted-foreground hover:text-destructive transition-colors cursor-pointer shrink-0"
          >
            <LogOut className="w-full h-full" />
          </button>
        </div>
        </div>
      </div>
    </aside>
  );
}

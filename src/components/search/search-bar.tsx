'use client';

import React, { useState, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search, MapPin, Sparkles, X, Coins } from "lucide-react";
import { ZonlixLoader } from "@/components/shared/zonlix-loader";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface SearchBarProps {
  onSearchStarted: (data: { searchId: string; status: string; source: string }) => void;
  onValidationStart?: () => void;
  onCancelSearch?: () => void;
  isSearchingActive?: boolean;
}

export function SearchBar({ onSearchStarted, onValidationStart, onCancelSearch, isSearchingActive = false }: SearchBarProps) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [ubicacion, setUbicacion] = useState("");
  const [limit, setLimit] = useState(20);
  const [localIsSearching, setLocalIsSearching] = useState(false);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [userCredits, setUserCredits] = useState<number | null>(null);

  React.useEffect(() => {
    const fetchCredits = async () => {
      const supabase = createClient();
      const { data } = await supabase.auth.getUser();
      if (data?.user) {
        const { data: profile } = await supabase
          .from("profiles")
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

  const isSearching = isSearchingActive || localIsSearching;

  const abortControllerRef = useRef<AbortController | null>(null);
  const activeSearchIdRef = useRef<string | null>(null);

  const isSuspicious = (text: string) =>
    /ignora|instrucciones|system prompt|override|<script>|select|drop table|<|>/i.test(text);

  const querySuspicious = isSuspicious(query);
  const locationSuspicious = isSuspicious(ubicacion);
  const requiredCredits = limit;
  const isInsufficientCredits = userCredits !== null && userCredits < requiredCredits;
  const isFormInvalid =
    query.length < 2 || ubicacion.length < 2 || querySuspicious || locationSuspicious || isInsufficientCredits;

  // CANCELAR BUSQUEDA
  const handleCancelSearch = useCallback(async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    setLocalIsSearching(false);
    setIsValidating(false);
    
    if (onCancelSearch) {
      onCancelSearch();
    }

    const searchIdToCancel = activeSearchIdRef.current;
    activeSearchIdRef.current = null;

    if (searchIdToCancel) {
      try {
        await fetch(`/api/searches/${searchIdToCancel}/cancel`, { method: "POST" });
        console.log(`[UI CANCEL] Busqueda ${searchIdToCancel} cancelada.`);
      } catch (err) {
        console.warn("[UI CANCEL] Error al contactar endpoint de cancelacion:", err);
      }
    }

    toast.info("Busqueda cancelada.", { duration: 2500 });
  }, [onCancelSearch]);

  // INICIAR BUSQUEDA
  const handleSearchSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (querySuspicious || locationSuspicious) {
      toast.error("Termino de busqueda no permitido.");
      return;
    }

    if (!query.trim() || query.length < 2) {
      toast.error("Ingresa el termino o categoria de busqueda");
      return;
    }

    if (!ubicacion.trim()) {
      toast.error("Ingresa la ciudad o ubicacion");
      return;
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;
    activeSearchIdRef.current = null;
    setIsValidating(true);
    setLocalIsSearching(false);
    setValidationError(null);
    if (onValidationStart) onValidationStart();

    try {
      const response = await fetch("/api/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim(), ubicacion: ubicacion.trim(), limit }),
        signal: controller.signal,
      });

      const data = await response.json();

      if (!response.ok) {
        setIsValidating(false);
        if (data.error === "INSUFFICIENT_CREDITS") {
          toast.error("Limite de Creditos Alcanzado", {
            description:
              data.message ||
              "Has consumido tus creditos del periodo. Espera a tu fecha de renovacion o contacta a soporte para un upgrade.",
            duration: 6000,
          });
        } else if (data.error === "APIFY_QUOTA_EXCEEDED") {
          setValidationError(data.message || "Los motores de búsqueda están experimentando una alta demanda temporal.");
        } else if (data.error === "INVALID_INPUT") {
          setValidationError(
            "Giro comercial o ciudad no reconocidos. Por favor verifica tus datos ingresados."
          );
        } else {
          toast.error("Ocurrió un error al procesar tu consulta. Por favor reintenta nuevamente.");
        }
        return;
      }

      setIsValidating(false);
      setLocalIsSearching(true);

      if (data.searchId) {
        activeSearchIdRef.current = data.searchId;
      }

      if (data.source === "cache") {
        toast.success("Resultados encontrados en cache. Cargando prospectos...");
      } else {
        toast.success("Busqueda iniciada en Google Maps. Los prospectos apareceran en breve.");
      }

      router.refresh();

      onSearchStarted({
        searchId: data.searchId,
        status: data.status,
        source: data.source,
      });
    } catch (err: any) {
      if (err?.name === "AbortError") {
        console.log("Búsqueda cancelada por el usuario.");
        return;
      }
      setIsValidating(false);
      toast.error("Error de conexion al iniciar la busqueda");
    } finally {
      if (abortControllerRef.current) {
        abortControllerRef.current = null;
        setIsValidating(false);
        setLocalIsSearching(false);
      }
    }
  };

  return (
    <form onSubmit={handleSearchSubmit} className="w-full space-y-4">
      <motion.div
        animate={
          isSearching
            ? {
                boxShadow: [
                  "0 0 0px rgba(16,185,129,0)",
                  "0 0 15px rgba(16,185,129,0.25)",
                  "0 0 0px rgba(16,185,129,0)",
                ],
              }
            : {}
        }
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
        className={`flex items-center w-full bg-zinc-900/90 border ${
          querySuspicious || locationSuspicious
            ? "border-red-500 shadow-red-500/20"
            : "border-zinc-800"
        } rounded-2xl p-1.5 gap-2 shadow-xl focus-within:border-emerald-500/40 transition-all max-w-4xl mx-auto`}
      >
        <div className="flex-1 min-w-0 flex items-center px-3 gap-2 border-r border-zinc-800/80">
          <motion.div
            className="absolute left-3.5 top-3.5"
            animate={isSearching ? { opacity: [1, 0.6, 1] } : {}}
            transition={{ repeat: Infinity, duration: 1.8 }}
          >
            <Search className="h-5 w-5 shrink-0 text-slate-400 dark:text-slate-500" />
          </motion.div>
          <Input
            placeholder="Que buscas? (ej. Clinicas dentales)"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isSearching || isValidating}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none h-10"
          />
        </div>

        <div className="flex-1 min-w-0 flex items-center px-3 gap-2 border-r border-zinc-800/80">
          <MapPin className="h-4 w-4 shrink-0 text-zinc-400" />
          <Input
            placeholder="Ubicacion (ej. Queretaro)"
            value={ubicacion}
            onChange={(e) => {
              setUbicacion(e.target.value);
              if (validationError) setValidationError(null);
            }}
            disabled={isSearching || isValidating}
            className="w-full bg-transparent text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none h-10"
          />
        </div>

        <div className="shrink-0 w-20 flex items-center px-2">
          <Select
            value={limit.toString()}
            onValueChange={(val) => setLimit(Number(val))}
            disabled={isSearching || isValidating}
          >
            <SelectTrigger className="w-full h-10 bg-transparent border-0 shadow-none text-zinc-100 font-medium focus:ring-0 hover:bg-zinc-800/50 rounded-lg transition-colors px-2">
              <SelectValue placeholder="Cantidad" />
            </SelectTrigger>
            <SelectContent className="bg-white dark:bg-zinc-900 border-zinc-200 dark:border-zinc-800 shadow-xl rounded-xl p-1 text-zinc-900 dark:text-zinc-100">
              <SelectItem
                value="10"
                className="hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg cursor-pointer"
              >
                10 prospectos
              </SelectItem>
              <SelectItem
                value="20"
                className="hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg cursor-pointer"
              >
                20 prospectos
              </SelectItem>
              <SelectItem
                value="50"
                className="hover:bg-zinc-100 dark:hover:bg-zinc-800/80 rounded-lg cursor-pointer"
              >
                50 prospectos
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="shrink-0">
          {isSearching || isValidating ? (
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                handleCancelSearch();
              }}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 text-sm font-medium rounded-xl transition-all"
            >
              {isValidating ? <ZonlixLoader size={18} inline /> : <X className="w-4 h-4"/>}
              <span>{isValidating ? "Validando..." : "Cancelar Búsqueda"}</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={isFormInvalid || isValidating}
              title={isInsufficientCredits ? "Saldo insuficiente" : "Buscar Prospectos"}
              className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-[0.98] text-white text-sm font-medium rounded-xl transition-all disabled:opacity-50 shadow-md shadow-emerald-500/10"
            >
              <Search className="w-4 h-4"/>
              <span>{isValidating ? "Validando..." : "Buscar Prospectos"}</span>
              {!isValidating && userCredits !== null && (
                <span className={`ml-1 px-2 py-0.5 text-xs rounded-full border font-mono ${isInsufficientCredits ? "bg-red-950 text-red-200 border-red-400/30" : "bg-black/20 text-emerald-100 border-white/10"}`}>
                  {requiredCredits} cr
                </span>
              )}
            </button>
          )}
        </div>
      </motion.div>

      <AnimatePresence>
        {isSearching && (
          <motion.div
            key="processing-hint"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.2 }}
            className="flex items-center justify-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 w-full max-w-4xl mx-auto"
          >
            <ZonlixLoader size={14} inline text="Procesando con IA y Google Maps..." />
          </motion.div>
        )}

        {(querySuspicious || locationSuspicious) && (
          <motion.div
            key="suspicious-error"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="text-red-500 text-sm font-medium text-center w-full max-w-4xl mx-auto"
          >
            Termino no permitido. Escribe una categoria valida sin simbolos o comandos.
          </motion.div>
        )}

        {validationError && !querySuspicious && !locationSuspicious && (
          <motion.div
            key="validation-error"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-300 dark:border-red-700 text-red-600 dark:text-red-400 text-sm font-medium w-full max-w-4xl mx-auto"
          >
            <span className="mt-0.5 shrink-0">X</span>
            <span>{validationError}</span>
          </motion.div>
        )}
      </AnimatePresence>
    </form>
  );
}
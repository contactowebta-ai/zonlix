"use client";

/**
 * /resultados - Historial completo de busquedas con filtro y paginacion
 */
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button, buttonVariants } from "@/components/ui/button";
import { StaggerContainer, StaggerItem } from "@/components/shared/stagger-container";
import {
  Search,
  History,
  MapPin,
  Calendar,
  Users,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchHistoryItem {
  id: string;
  query: string;
  ubicacion: string;
  status: string;
  total_resultados: number | null;
  results_json?: any;
  created_at: string;
}

const PAGE_SIZE = 8;

const STATUS_STYLES: Record<string, string> = {
  completado: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/30",
  procesando: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-500/10 dark:text-blue-400 dark:border-blue-500/30",
  pendiente:  "bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-500/10 dark:text-yellow-400 dark:border-yellow-500/30",
};

export default function ResultadosPage() {
  const [allSearches, setAllSearches] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [keyword, setKeyword] = useState("");
  const [page, setPage] = useState(1);

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setAllSearches([]);
        return;
      }

      const { data, error } = await (supabase.from("searches") as any)
        .select("id, query, ubicacion, status, total_resultados, results_json, created_at")
        .eq("user_id", user.id)
        .gt("total_resultados", 0)
        .not("query", "ilike", "%ignora%")
        .order("created_at", { ascending: false })
        .limit(200);

      if (error) {
        console.error("[ResultadosPage] Error loading history:", error);
      } else if (data) {
        setAllSearches(data as SearchHistoryItem[]);
      }
    } catch (err) {
      console.error("[ResultadosPage] Error loading history:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  const filtered = allSearches.filter((s) => {
    if (!keyword.trim()) return true;
    const kw = keyword.toLowerCase();
    return s.query.toLowerCase().includes(kw) || s.ubicacion.toLowerCase().includes(kw);
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const handleKeyword = (v: string) => {
    setKeyword(v);
    setPage(1);
  };

  const getCount = (item: SearchHistoryItem) =>
    item.total_resultados ??
    (Array.isArray(item.results_json)
      ? item.results_json.length
      : (item.results_json as any)?.data?.length ?? 0);

  return (
    <StaggerContainer className="space-y-6 max-w-5xl mx-auto py-6 px-4">
      <StaggerItem>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
              <History className="w-6 h-6 text-primary" />
              Historial de Busquedas
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Todas tus busquedas validas con sus prospectos extraidos.
            </p>
          </div>
          <Link
            href="/buscar"
            className="inline-flex items-center gap-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-semibold text-sm px-4 py-2 rounded-xl transition-all shadow-sm"
          >
            <Search className="w-4 h-4" />
            Nueva Busqueda
          </Link>
        </div>
      </StaggerItem>

      <StaggerItem>
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Filtrar por categoria o ciudad..."
            value={keyword}
            onChange={(e) => handleKeyword(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
      </StaggerItem>

      <StaggerItem>
        <Card className="border-border bg-card shadow-sm">
          <CardContent className="p-0">
            {loading ? (
              <div className="flex items-center justify-center py-20 gap-3 text-muted-foreground text-sm">
                <Loader2 className="w-5 h-5 animate-spin" />
                Cargando historial...
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
                <History className="w-10 h-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  {keyword ? `Sin resultados para "${keyword}"` : "Aun no tienes busquedas guardadas."}
                </p>
                {!keyword && (
                  <Link href="/buscar" className="text-xs text-primary hover:underline">
                    Realiza tu primera busqueda
                  </Link>
                )}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {paginated.map((item) => {
                  const count = getCount(item);
                  const dateStr = new Date(item.created_at).toLocaleDateString("es-MX", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });
                  const statusStyle =
                    STATUS_STYLES[item.status] ??
                    "bg-zinc-100 text-zinc-600 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:border-zinc-700";

                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/40 transition-colors"
                    >
                      <div className="space-y-1 min-w-0 flex-1 mr-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm text-foreground truncate">
                            {item.query}
                          </span>
                          <span className="text-muted-foreground text-xs">en</span>
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md shrink-0">
                            <MapPin className="w-3 h-3" />
                            {item.ubicacion}
                          </span>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", statusStyle)}>
                            {item.status}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {dateStr}
                          </span>
                          <span className="flex items-center gap-1">
                            <Users className="w-3 h-3 text-emerald-500" />
                            {count} prospectos
                          </span>
                        </div>
                      </div>

                      <Link
                        href={`/buscar?searchId=${item.id}`}
                        className={cn(buttonVariants({ variant: "outline", size: "sm" }), "text-xs gap-1 h-8 shrink-0")}
                      >
                        Ver prospectos
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </StaggerItem>

      {!loading && totalPages > 1 && (
        <StaggerItem>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>
              {filtered.length} busqueda{filtered.length !== 1 ? "s" : ""} en {totalPages} pagina{totalPages !== 1 ? "s" : ""} (mostrando {page}/{totalPages})
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="h-8 gap-1"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                Anterior
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page === totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="h-8 gap-1"
              >
                Siguiente
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </StaggerItem>
      )}
    </StaggerContainer>
  );
}
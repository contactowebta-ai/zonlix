"use client";

/**
 * src/components/search/recent-searches.tsx
 *
 * Componente que muestra las últimas 5 búsquedas realizadas por el usuario.
 */
import React, { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button, buttonVariants } from "@/components/ui/button";
import { History, MapPin, Search, Calendar, Users, ExternalLink, ChevronRight, Trash2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { deleteSearchHistoryItem } from "@/app/actions/search.actions";

interface SearchHistoryItem {
  id: string;
  query: string;
  ubicacion: string;
  status: string;
  total_resultados?: number;
  created_at: string;
}

interface RecentSearchesProps {
  onLoaded?: (hasSearches: boolean) => void;
}

export function RecentSearches({ onLoaded }: RecentSearchesProps) {
  const [searches, setSearches] = useState<SearchHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pageLimit, setPageLimit] = useState(5);

  useEffect(() => {
    async function loadRecentSearches() {
      try {
        const supabase = createClient();
        
        const { data: { user } } = await supabase.auth.getUser();
        
        if (!user) {
          setSearches([]);
          onLoaded?.(false);
          return;
        }

        const { data, error } = await (supabase.from("searches") as any)
          .select("id, query, ubicacion, created_at, total_resultados, status")
          .eq("user_id", user.id)
          .eq("status", "completado")
          .gt("total_resultados", 0)
          .not("query", "ilike", "%ignora%")
          .order("created_at", { ascending: false })
          .limit(pageLimit);

        if (error) {
          console.warn("[RecentSearches] Warning:", error?.message || error?.details || JSON.stringify(error));
          setSearches([]);
          onLoaded?.(false);
        } else if (data) {
          const items = data as SearchHistoryItem[];
          setSearches(items);
          onLoaded?.(items.length > 0);
        } else {
          setSearches([]);
          onLoaded?.(false);
        }
      } catch (err: any) {
        console.warn("[RecentSearches] Warning:", err?.message || err);
        setSearches([]);
        onLoaded?.(false);
      } finally {
        setLoading(false);
      }
    }

    loadRecentSearches();
  }, [onLoaded, pageLimit]);

  const handleDeleteSearch = (id: string) => {
    setSearches(prev => prev.filter(s => s.id !== id));
  };


  if (loading && searches.length === 0) {
    return null; 
  }

  if (searches.length === 0) {
    return null;
  }

  return (
    <Card className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800 shadow-sm text-zinc-900 dark:text-zinc-100">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-zinc-900 dark:text-zinc-100">
            <History className="w-4 h-4 text-primary" />
            Búsquedas Recientes
          </CardTitle>
          <Link
            href="/resultados"
            className="flex items-center gap-0.5 text-xs text-primary hover:text-primary/80 font-medium transition-colors"
          >
            Ver todo el historial
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {searches.map((item) => (
            <RecentSearchItem key={item.id} item={item} onDelete={handleDeleteSearch} />
          ))}
          
          {searches.length >= pageLimit && (
            <Button
              variant="ghost"
              className="w-full mt-2 text-xs text-muted-foreground hover:bg-muted/50 transition-colors"
              onClick={() => setPageLimit(prev => prev + 5)}
              disabled={loading}
            >
              Cargar más búsquedas
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function RecentSearchItem({ item, onDelete }: { item: SearchHistoryItem, onDelete: (id: string) => void }) {
  const [isDeleting, setIsDeleting] = useState(false);

  const dateStr = new Date(item.created_at).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
  const count = item.total_resultados || 0;

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!confirm('¿Estás seguro de que deseas eliminar esta búsqueda del historial?')) return;

    setIsDeleting(true);
    const res = await deleteSearchHistoryItem(item.id);
    setIsDeleting(false);

    if (res.success) {
      toast.success('Búsqueda eliminada del historial.');
      onDelete(item.id);
    } else {
      toast.error(res.error || 'No se pudo eliminar la búsqueda.');
    }
  };

  return (
    <div className="group relative flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/80 hover:bg-zinc-100 dark:hover:bg-zinc-800/60 transition-colors">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        title="Eliminar de historial"
        className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/80 dark:bg-zinc-800/80 hover:bg-rose-50 dark:hover:bg-rose-500/20 text-zinc-400 hover:text-rose-500 border border-border/50 hover:border-rose-200 dark:hover:border-rose-500/30 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
      >
        {isDeleting ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin text-rose-500"/>
        ) : (
          <Trash2 className="w-3.5 h-3.5"/>
        )}
      </button>

      <div className="space-y-1">
        <div className="flex items-center gap-2 font-medium text-sm text-zinc-900 dark:text-zinc-100 pr-8">
          <Search className="w-3.5 h-3.5 text-primary" />
          <span>{item.query}</span>
          <span className="text-zinc-500 dark:text-zinc-400 font-normal">en</span>
          <span className="inline-flex items-center gap-1 text-xs text-zinc-600 dark:text-zinc-400 bg-zinc-200/50 dark:bg-zinc-800/50 px-2 py-0.5 rounded-md">
            <MapPin className="w-3 h-3" />
            {item.ubicacion}
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
        className={cn(
          buttonVariants({ variant: "outline", size: "sm" }),
          "text-xs gap-1 h-8 bg-white dark:bg-zinc-800 border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-zinc-100 hover:bg-zinc-100 dark:hover:bg-zinc-700"
        )}
      >
        Ver prospectos
        <ExternalLink className="w-3 h-3" />
      </Link>
    </div>
  );
}

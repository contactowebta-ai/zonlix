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
import { History, MapPin, Search, Calendar, Users, ExternalLink, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

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


  if (loading && searches.length === 0) {
    return null; 
  }

  if (searches.length === 0) {
    return null;
  }

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base font-semibold flex items-center gap-2 text-foreground">
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
          {searches.map((item) => {
            const dateStr = new Date(item.created_at).toLocaleDateString("es-MX", {
              day: "numeric",
              month: "short",
              hour: "2-digit",
              minute: "2-digit",
            });

            const count = item.total_resultados || 0;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between p-3 rounded-lg border border-border/60 bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2 font-medium text-sm text-foreground">
                    <Search className="w-3.5 h-3.5 text-primary" />
                    <span>{item.query}</span>
                    <span className="text-muted-foreground font-normal">en</span>
                    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-md">
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
                    "text-xs gap-1 h-8"
                  )}
                >
                  Ver prospectos
                  <ExternalLink className="w-3 h-3" />
                </Link>
              </div>
            );
          })}
          
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

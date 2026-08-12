"use client";

/**
 * src/app/(dashboard)/buscar/page.tsx
 *
 * Página de búsqueda de prospectos con mapa/apify e integración en tiempo real.
 */
import React, { useState, useEffect, Suspense, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { SearchBar } from "@/components/search/search-bar";
import { RecentSearches } from "@/components/search/recent-searches";
import { ProspectRealtimeList } from "@/components/prospects/prospect-realtime-list";
import { StaggerContainer, StaggerItem } from "@/components/shared/stagger-container";
import { Card, CardContent } from "@/components/ui/card";
import { Search, Sparkles, MapPin, Bot } from "lucide-react";
import { ProspectsLoadingSkeleton } from "@/components/search/prospects-loading-skeleton";

function BuscarContent() {
  const searchParams = useSearchParams();
  const urlSearchId = searchParams.get("searchId");

  const [activeSearch, setActiveSearch] = useState<{
    searchId: string;
    status: string;
  } | null>(urlSearchId ? { searchId: urlSearchId, status: "completado" } : null);

  const [hasSearches, setHasSearches] = useState<boolean | null>(null);
  const [isStartingSearch, setIsStartingSearch] = useState(false);

  // Allow URL parameter to set active search if navigated to directly
  useEffect(() => {
    if (urlSearchId && (!activeSearch || activeSearch.searchId !== urlSearchId)) {
      setActiveSearch({ searchId: urlSearchId, status: "completado" });
    }
  }, [urlSearchId, activeSearch]);

  const handleStatusChange = useCallback((newStatus: string) => {
    setActiveSearch((prev) => {
      if (!prev || prev.status === newStatus) return prev;
      return { ...prev, status: newStatus };
    });
  }, []);

  return (
    <StaggerContainer className="space-y-6 max-w-5xl mx-auto py-6 px-4">
      {/* Encabezado */}
      <StaggerItem>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-2">
          <Search className="w-7 h-7 text-primary" />
          Prospección con Inteligencia Artificial
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Ingresa una categoría y ciudad para extraer empresas en tiempo real y auditar su presencia digital con IA.
        </p>
      </StaggerItem>

      {/* Barra de búsqueda */}
      <StaggerItem>
        <SearchBar
          isSearchingActive={!!activeSearch && activeSearch.status !== 'completado' && activeSearch.status !== 'error'}
          onValidationStart={() => {
            setActiveSearch(null);
            setIsStartingSearch(true);
          }}
          onValidationEnd={() => {
            setIsStartingSearch(false);
          }}
          onCancelSearch={() => {
            setActiveSearch(null);
            setIsStartingSearch(false);
          }}
          onSearchStarted={(data) => {
            setActiveSearch({
              searchId: data.searchId,
              status: data.status,
            });
            setIsStartingSearch(false);
            setHasSearches(true);
          }}
        />
      </StaggerItem>

      {/* Área de resultados en tiempo real o Búsquedas Recientes */}
      <StaggerItem>
        {activeSearch ? (
          <ProspectRealtimeList
            searchId={activeSearch.searchId}
            initialStatus={activeSearch.status}
            onStatusChange={handleStatusChange}
          />
        ) : isStartingSearch ? (
          <ProspectsLoadingSkeleton />
        ) : (
          <div className="space-y-6">
            <RecentSearches onLoaded={setHasSearches} />

            {hasSearches === false && (
              <Card className="border-border bg-card/50 py-10 text-center">
                <CardContent className="space-y-4">
                  <div className="mx-auto w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                    <Sparkles className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg">Inicia tu primera búsqueda</h3>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto mt-1">
                      Prueba buscando sectores como &quot;Clínicas dentales en Monterrey&quot; o &quot;Agencias de viajes en Guadalajara&quot;.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </StaggerItem>
    </StaggerContainer>
  );
}

export default function BuscarPage() {
  return (
    <Suspense fallback={<div className="p-8 text-center text-muted-foreground">Cargando búsqueda...</div>}>
      <BuscarContent />
    </Suspense>
  );
}



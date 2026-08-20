-- ============================================================
-- MIGRATION: 0008 — Complete searches schema
-- ============================================================
-- Adds columns that the application code depends on but were
-- never declared in a migration file. All columns use
-- IF NOT EXISTS to be safely idempotent.
-- ============================================================

ALTER TABLE public.searches
  ADD COLUMN IF NOT EXISTS apify_run_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS apify_dataset_id TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS results_json JSONB DEFAULT NULL;

-- Index for webhook lookup by run ID (if not already created by 0007)
CREATE INDEX IF NOT EXISTS idx_searches_apify_run_id
  ON public.searches (apify_run_id)
  WHERE apify_run_id IS NOT NULL;

COMMENT ON COLUMN public.searches.apify_run_id IS
  'ID del run de Apify asociado a esta búsqueda. Usado por el webhook para correlacionar resultados.';

COMMENT ON COLUMN public.searches.apify_dataset_id IS
  'ID del dataset de Apify que contiene los resultados crudos del scraping.';

COMMENT ON COLUMN public.searches.results_json IS
  'Resultados procesados y deduplicados de la búsqueda. Formato: { data: ApifyPlace[], _limit: number }.';

-- ============================================================
-- MIGRATION: 0007 — Searches: Processing Lock + Credit Hold
-- ============================================================
--
-- COLUMNA 1: processing_started_at
-- ---------------------------------
-- Permite el claim atómico en el webhook de Apify.
-- El webhook hace un UPDATE ... WHERE processing_started_at IS NULL
-- RETURNING id. Si Postgres no devuelve filas, otro worker ya tomó
-- el trabajo — salimos con 200 "Already Processing" sin duplicar.
--
-- COLUMNA 2: credits_held
-- ------------------------
-- Guarda cuántos créditos se descontaron ANTES de lanzar Apify
-- (el hold preventivo). Cuando el webhook procesa los leads reales,
-- compara: si leads_reales < credits_held, devuelve la diferencia
-- atómicamente con increment_credits(credits_held - leads_reales).
-- Esto cierra la fuga financiera por DoS económico (P1).
-- ============================================================

ALTER TABLE public.searches
  ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS credits_held INTEGER NOT NULL DEFAULT 0;

-- Índice parcial para agilizar el lookup del claim atómico
-- (solo rows que aún no han sido reclamadas)
CREATE INDEX IF NOT EXISTS idx_searches_processing_claim
  ON public.searches (apify_run_id)
  WHERE processing_started_at IS NULL;

COMMENT ON COLUMN public.searches.processing_started_at IS
  'Timestamp del momento en que un worker tomó este job. NULL = disponible para claim. Usada para el lock atómico en el webhook de Apify.';

COMMENT ON COLUMN public.searches.credits_held IS
  'Créditos descontados preventivamente (hold) antes de llamar a Apify. El webhook calcula la diferencia y reembolsa si los leads reales son menores.';

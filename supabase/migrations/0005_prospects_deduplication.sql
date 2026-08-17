-- ============================================================
-- MIGRATION: 0005 — Prospects Deduplication Constraint
-- ============================================================
-- FIX P1 → Race condition en SELECT → INSERT de prospectos.
--
-- Sin esta restricción, dos clicks rápidos pueden generar
-- prospectos duplicados y cobros dobles porque el check de
-- existencia en la aplicación no es atómico.
--
-- La restricción UNIQUE a nivel de motor de base de datos es
-- la única defensa real: Postgres rechaza el segundo INSERT
-- en una transacción concurrente, sin importar el timing.
-- ============================================================

ALTER TABLE public.prospects
  ADD CONSTRAINT prospects_user_id_place_id_key UNIQUE (user_id, place_id);

-- Nota: Si ya existen duplicados en la tabla, esta migración
-- fallará con "duplicate key value violates unique constraint".
-- En ese caso, limpia primero los duplicados con:
--
-- DELETE FROM public.prospects
-- WHERE id NOT IN (
--   SELECT MIN(id) FROM public.prospects GROUP BY user_id, place_id
-- );
--
-- Luego vuelve a ejecutar este ALTER TABLE.

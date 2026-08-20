-- ============================================================
-- MIGRATION: 0011 — Financial states and RPC security
-- ============================================================

-- 1. Añadir estado 'cancelado' a la búsqueda
ALTER TYPE search_status ADD VALUE IF NOT EXISTS 'cancelado';

-- 2. Revocar acceso público a RPCs financieros
REVOKE ALL ON FUNCTION public.decrement_credits(uuid, int) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.increment_credits(uuid, int) FROM PUBLIC;

-- Validar que service_role tenga permisos (ya existía pero por seguridad se fuerza)
GRANT EXECUTE ON FUNCTION public.decrement_credits(uuid, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, int) TO service_role;

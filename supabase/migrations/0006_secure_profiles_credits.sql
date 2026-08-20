-- ============================================================
-- MIGRATION: 0006 — Reinforce Column-Level Security on profiles
-- ============================================================
-- P0 — Prevenir auto-asignación de créditos desde el cliente.
--
-- Capas de defensa (defense-in-depth):
--   1. REVOKE/GRANT a nivel de columna (Column-Level Security, CLS)
--      → Postgres rechaza el UPDATE en columnas financieras si el
--        rol que ejecuta la query es `authenticated` o `anon`.
--   2. Trigger BEFORE UPDATE `protect_profile_billing_trigger`
--      → Fuerza que NEW.credits_remaining = OLD.credits_remaining
--        cuando el rol no es service_role/postgres/supabase_admin.
--        (creado en 20260814_secure_profiles_rls.sql)
--
-- NOTA: Los GRANT/REVOKE ya fueron aplicados en 0004 y
-- 20260814_0004_secure_profiles_columns.sql.
-- Esta migración es IDEMPOTENTE — se puede re-ejecutar sin riesgo.
-- ============================================================

-- 1. Revocar UPDATE completo del rol de usuarios autenticados
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

-- 2. Otorgar UPDATE ÚNICAMENTE en columnas no financieras
GRANT UPDATE (
  sector,
  sector_personalizado,
  descripcion,
  sitio_web,
  portafolio_url,
  precio_promedio,
  linkedin_url,
  instagram_url,
  facebook_url,
  ventajas,
  icp,
  onboarding_completado
) ON public.profiles TO authenticated;

-- 3. El service_role (backend exclusivo) mantiene acceso total
GRANT UPDATE ON public.profiles TO service_role;

-- ============================================================
-- Verificación: columnas financieras BLOQUEADAS para usuarios:
--   - credits_remaining  ← NO en el GRANT anterior
--   - credits_limit      ← NO en el GRANT anterior
--   - subscription_renewal_date ← NO en el GRANT anterior
-- ============================================================

-- ============================================================
-- MIGRATION: 0009 — Complete profiles schema
-- ============================================================
-- Adds columns that the application code depends on but were
-- never declared in a migration file. All columns use
-- IF NOT EXISTS to be safely idempotent.
--
-- IMPORTANT: After adding these columns, the CLS GRANT must be
-- updated to include them in the list of user-updatable columns.
-- Otherwise authenticated users will get permission denied when
-- trying to save their profile with these fields.
-- ============================================================

-- 1. Add missing columns
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sector_personalizado TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS linkedin_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS instagram_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS facebook_url TEXT DEFAULT NULL;

-- 2. Update CLS grant to include the new columns
-- (Re-issuing the full GRANT is idempotent and ensures consistency
--  with the list in 0006_secure_profiles_credits.sql)
REVOKE UPDATE ON public.profiles FROM authenticated;

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

COMMENT ON COLUMN public.profiles.sector_personalizado IS
  'Sector libre ingresado por el usuario cuando selecciona "Otro Sector".';

COMMENT ON COLUMN public.profiles.linkedin_url IS
  'URL del perfil de LinkedIn de la agencia/empresa.';

COMMENT ON COLUMN public.profiles.instagram_url IS
  'URL del perfil de Instagram de la agencia/empresa.';

COMMENT ON COLUMN public.profiles.facebook_url IS
  'URL de la página de Facebook de la agencia/empresa.';

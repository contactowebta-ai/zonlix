-- ============================================================
-- MIGRATION: 0010 — Fix profiles CLS and Schema
-- ============================================================

-- 1. SINCRONIZAR LA COLUMNA FANTASMA
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS diagnostico_ia JSONB;

-- 2. REPARAR EL GRANT UPDATE EN PROFILES
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
  onboarding_completado,
  updated_at,
  diagnostico_ia
) ON public.profiles TO authenticated;

-- 3. SELLAR LA FUGA EN EL INSERT
-- Evita que usuarios autenticados inyecten créditos iniciales manipulados al crear su perfil.
CREATE OR REPLACE FUNCTION public.enforce_profile_insert_credits()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el rol es distinto a service_role (ej. authenticated o anon),
  -- forzamos los valores iniciales gratuitos por defecto (500 créditos).
  IF current_setting('role') <> 'service_role' THEN
    NEW.credits_remaining = 500;
    NEW.credits_limit = 500;
    NEW.subscription_renewal_date = (now() + interval '1 month');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS tr_enforce_profile_insert_credits ON public.profiles;
CREATE TRIGGER tr_enforce_profile_insert_credits
BEFORE INSERT ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.enforce_profile_insert_credits();

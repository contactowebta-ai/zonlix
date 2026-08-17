-- Fix 1.1: Sellar el Bypass de RLS en Perfiles
-- Prevenir auto-asignación de créditos por usuarios autenticados
CREATE OR REPLACE FUNCTION protect_profile_billing_fields()
RETURNS TRIGGER AS $$
BEGIN
  -- Si el rol que hace el update NO es un rol administrativo o de servicio, 
  -- forzamos que las columnas sensibles mantengan su valor anterior.
  IF current_user NOT IN ('service_role', 'postgres', 'supabase_admin') THEN
    NEW.credits_remaining := OLD.credits_remaining;
    NEW.credits_limit := OLD.credits_limit;
    NEW.subscription_renewal_date := OLD.subscription_renewal_date;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS protect_profile_billing_trigger ON profiles;

CREATE TRIGGER protect_profile_billing_trigger
BEFORE UPDATE ON profiles
FOR EACH ROW
EXECUTE FUNCTION protect_profile_billing_fields();

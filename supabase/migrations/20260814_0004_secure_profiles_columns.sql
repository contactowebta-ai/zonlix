-- Revocar todos los permisos de UPDATE públicos sobre la tabla
REVOKE UPDATE ON public.profiles FROM authenticated, anon;

-- Otorgar permiso de UPDATE SÓLO en las columnas no financieras
GRANT UPDATE (
  sector,
  descripcion,
  sitio_web,
  portafolio_url,
  precio_promedio,
  ventajas,
  icp,
  onboarding_completado
) ON public.profiles TO authenticated;

-- El service_role (backend) mantiene todos los permisos
GRANT UPDATE ON public.profiles TO service_role;

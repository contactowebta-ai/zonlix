-- ============================================================
-- MIGRATION: 0004 — Red Team Patches (Security Audit 2026-08-16)
-- ============================================================
-- FIX 1.1 → Column-Level Security (CLS) on profiles
-- FIX 1.2 → Multi-tenant isolation on child tables (BOLA fix)
-- ============================================================

-- ============================================================
-- FIX 1.1 — COLUMN-LEVEL SECURITY (CLS) ON profiles
-- Seals the table against self-assignment of financial fields
-- (credits_remaining, plan, etc.) by authenticated/anon users.
-- Only service_role (backend) retains full UPDATE privileges.
-- ============================================================

REVOKE UPDATE ON public.profiles FROM authenticated, anon;

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

GRANT UPDATE ON public.profiles TO service_role;


-- ============================================================
-- FIX 1.2 — MULTI-TENANT ISOLATION ON CHILD TABLES (BOLA)
--
-- The previous INSERT/UPDATE policies only checked user_id on
-- the child table itself, allowing a malicious user to inject
-- a prospect_id belonging to another tenant.
--
-- New policies add an EXISTS sub-query to verify that the
-- referenced prospect_id is owned by auth.uid(), closing the
-- Broken Object Level Authorization (BOLA) attack surface.
-- ============================================================

-- ------------------------------------------------------------
-- AUDITS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "audits_insert_own" ON audits;
CREATE POLICY "audits_insert_own" ON audits
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "audits_update_own" ON audits;
CREATE POLICY "audits_update_own" ON audits
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- MESSAGES
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
CREATE POLICY "messages_insert_own" ON messages
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "messages_update_own" ON messages;
CREATE POLICY "messages_update_own" ON messages
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- OBJECTIONS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "objections_insert_own" ON objections;
CREATE POLICY "objections_insert_own" ON objections
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "objections_update_own" ON objections;
CREATE POLICY "objections_update_own" ON objections
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

-- ------------------------------------------------------------
-- FOLLOW_UPS
-- ------------------------------------------------------------
DROP POLICY IF EXISTS "follow_ups_insert_own" ON follow_ups;
CREATE POLICY "follow_ups_insert_own" ON follow_ups
  FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "follow_ups_update_own" ON follow_ups;
CREATE POLICY "follow_ups_update_own" ON follow_ups
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM prospects p
      WHERE p.id = prospect_id
        AND p.user_id = auth.uid()
    )
  );

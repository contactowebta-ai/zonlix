-- ============================================
-- MIGRATION: 0003 - Enforce strict RLS on all tables
-- ============================================

-- Ensure RLS is enabled for all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.searches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.prospects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objections ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.follow_ups ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 0. RPC FUNCTIONS (ATOMIC TRANSACTIONS)
-- ============================================
CREATE OR REPLACE FUNCTION decrement_credits(p_user_id uuid, p_amount int)
RETURNS int AS $$
  UPDATE profiles
  SET credits_remaining = credits_remaining - p_amount
  WHERE id = p_user_id AND credits_remaining >= p_amount
  RETURNING credits_remaining;
$$ LANGUAGE sql;

CREATE OR REPLACE FUNCTION increment_credits(p_user_id uuid, p_amount int)
RETURNS int AS $$
  UPDATE profiles
  SET credits_remaining = credits_remaining + p_amount
  WHERE id = p_user_id
  RETURNING credits_remaining;
$$ LANGUAGE sql;

-- ============================================
-- 1. PROFILES
-- ============================================
DROP POLICY IF EXISTS "profiles_select_own" ON profiles;
DROP POLICY IF EXISTS "profiles_insert_own" ON profiles;
DROP POLICY IF EXISTS "profiles_update_own" ON profiles;
DROP POLICY IF EXISTS "profiles_delete_own" ON profiles;

CREATE POLICY "profiles_select_own" ON profiles FOR SELECT USING (auth.uid() = id);
CREATE POLICY "profiles_insert_own" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);
CREATE POLICY "profiles_update_own" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "profiles_delete_own" ON profiles FOR DELETE USING (auth.uid() = id);

-- ============================================
-- 2. SEARCHES
-- ============================================
DROP POLICY IF EXISTS "searches_select_own" ON searches;
DROP POLICY IF EXISTS "searches_insert_own" ON searches;
DROP POLICY IF EXISTS "searches_update_own" ON searches;
DROP POLICY IF EXISTS "searches_delete_own" ON searches;

CREATE POLICY "searches_select_own" ON searches FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "searches_insert_own" ON searches FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "searches_update_own" ON searches FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "searches_delete_own" ON searches FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 3. PROSPECTS
-- ============================================
DROP POLICY IF EXISTS "prospects_select_own" ON prospects;
DROP POLICY IF EXISTS "prospects_insert_own" ON prospects;
DROP POLICY IF EXISTS "prospects_update_own" ON prospects;
DROP POLICY IF EXISTS "prospects_delete_own" ON prospects;

CREATE POLICY "prospects_select_own" ON prospects FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "prospects_insert_own" ON prospects FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prospects_update_own" ON prospects FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "prospects_delete_own" ON prospects FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 4. AUDITS
-- ============================================
DROP POLICY IF EXISTS "audits_select_own" ON audits;
DROP POLICY IF EXISTS "audits_insert_own" ON audits;
DROP POLICY IF EXISTS "audits_update_own" ON audits;
DROP POLICY IF EXISTS "audits_delete_own" ON audits;

CREATE POLICY "audits_select_own" ON audits FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "audits_insert_own" ON audits FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "audits_update_own" ON audits FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "audits_delete_own" ON audits FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 5. MESSAGES
-- ============================================
DROP POLICY IF EXISTS "messages_select_own" ON messages;
DROP POLICY IF EXISTS "messages_insert_own" ON messages;
DROP POLICY IF EXISTS "messages_update_own" ON messages;
DROP POLICY IF EXISTS "messages_delete_own" ON messages;

CREATE POLICY "messages_select_own" ON messages FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "messages_insert_own" ON messages FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "messages_update_own" ON messages FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "messages_delete_own" ON messages FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 6. OBJECTIONS
-- ============================================
DROP POLICY IF EXISTS "objections_select_own" ON objections;
DROP POLICY IF EXISTS "objections_insert_own" ON objections;
DROP POLICY IF EXISTS "objections_update_own" ON objections;
DROP POLICY IF EXISTS "objections_delete_own" ON objections;

CREATE POLICY "objections_select_own" ON objections FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "objections_insert_own" ON objections FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "objections_update_own" ON objections FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "objections_delete_own" ON objections FOR DELETE USING (auth.uid() = user_id);

-- ============================================
-- 7. FOLLOW_UPS
-- ============================================
DROP POLICY IF EXISTS "follow_ups_select_own" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_insert_own" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_update_own" ON follow_ups;
DROP POLICY IF EXISTS "follow_ups_delete_own" ON follow_ups;

CREATE POLICY "follow_ups_select_own" ON follow_ups FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "follow_ups_insert_own" ON follow_ups FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "follow_ups_update_own" ON follow_ups FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "follow_ups_delete_own" ON follow_ups FOR DELETE USING (auth.uid() = user_id);

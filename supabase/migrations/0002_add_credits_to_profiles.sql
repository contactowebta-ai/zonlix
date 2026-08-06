-- ============================================
-- MIGRATION: Add Credits to Profiles & Enable Realtime
-- ============================================

ALTER TABLE profiles
ADD COLUMN credits_remaining integer DEFAULT 500,
ADD COLUMN credits_limit integer DEFAULT 500,
ADD COLUMN subscription_renewal_date timestamptz DEFAULT (now() + interval '1 month');

-- Enable realtime for the profiles table
BEGIN;
  ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
COMMIT;

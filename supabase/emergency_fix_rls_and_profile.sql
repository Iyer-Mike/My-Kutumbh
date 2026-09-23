-- ══════════════════════════════════════════════════════════════════
-- EMERGENCY FIX: Restore owner profile + fix recursive RLS
-- Run this in Supabase SQL Editor BEFORE completing onboarding.
-- ══════════════════════════════════════════════════════════════════

-- ── Step 1: Ensure profiles always allows self-read ──────────────
-- This guarantees the dashboard can always read its own profile
-- even if the family-roster policy fails.
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

-- ── Step 2: Create a SECURITY DEFINER helper to avoid recursion ──
-- RLS policies that reference kutumbh_members inside a subquery
-- cause infinite recursion. This function bypasses RLS safely.
CREATE OR REPLACE FUNCTION get_my_kutumbh_id()
RETURNS UUID
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid() LIMIT 1
$$;

-- ── Step 3: Fix kutumbh_members RLS – add simple self-read ───────
-- Without this, the onboarding page's membership check returns empty,
-- making it appear the user has no kutumbh.
DROP POLICY IF EXISTS "Users can view own membership" ON kutumbh_members;
CREATE POLICY "Users can view own membership"
  ON kutumbh_members FOR SELECT
  USING (user_id = auth.uid());

-- Replace the family-roster policy to use the SECURITY DEFINER fn
DROP POLICY IF EXISTS "Members can view kutumbh roster" ON kutumbh_members;
CREATE POLICY "Members can view kutumbh roster"
  ON kutumbh_members FOR SELECT
  USING (kutumbh_id = get_my_kutumbh_id());

-- ── Step 4: Fix profiles family policy to use the helper fn ──────
DROP POLICY IF EXISTS "Members can view family profiles" ON profiles;
CREATE POLICY "Members can view family profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM kutumbh_members
      WHERE kutumbh_id = get_my_kutumbh_id()
    )
  );

-- ── Step 5: Restore owner's onboarding_complete flag ─────────────
-- The owner's profile may have lost onboarding_complete = true.
-- This sets it back without touching any other profile data.
UPDATE profiles
SET onboarding_complete = true
WHERE id = (
  SELECT id FROM auth.users WHERE email = 'iyer.mike@gmail.com'
)
AND (onboarding_complete IS NULL OR onboarding_complete = false);

-- ── Verify the fix ────────────────────────────────────────────────
SELECT
  u.email,
  p.full_name,
  p.onboarding_complete,
  km.role,
  k.name AS kutumbh_name
FROM auth.users u
LEFT JOIN profiles p ON p.id = u.id
LEFT JOIN kutumbh_members km ON km.user_id = u.id
LEFT JOIN kutumbhs k ON k.id = km.kutumbh_id
WHERE u.email = 'iyer.mike@gmail.com';

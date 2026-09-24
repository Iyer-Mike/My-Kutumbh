-- ══════════════════════════════════════════════════
-- Phase 8c — A profile is as private as a medical report
--
-- Medical reports are yours alone, plus the Prime Member. Profiles were not:
-- any member of the family could read another member's whole row, which holds
-- conditions, allergies, medications, weight and date of birth. No screen
-- showed them, but the rule has to hold in the database, not on the screen.
--
-- The family pages only ever need a name and a Prakriti, so those two come
-- from a narrow view instead.
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- 1. The profile itself: yourself, or the Prime Member of your Kutumbh
DROP POLICY IF EXISTS "Members can view family profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"       ON public.profiles;
DROP POLICY IF EXISTS "profiles_select"                  ON public.profiles;

CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (
    id = auth.uid()
    OR id IN (
      SELECT km.user_id
      FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_prime_kutumbh_ids())
    )
  );

-- 2. What the family pages are allowed to know about each other:
--    a name, a Prakriti, and who the Prime Member is. Nothing medical.
--    The view runs as its owner and filters to the caller's own Kutumbh,
--    so it can read profiles without opening the whole row to members.
DROP VIEW IF EXISTS public.family_roster;

CREATE VIEW public.family_roster
WITH (security_invoker = false) AS
  SELECT
    p.id,
    p.full_name,
    p.primary_dosha,
    km.kutumbh_id,
    km.role
  FROM public.profiles p
  JOIN public.kutumbh_members km ON km.user_id = p.id
  WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids());

GRANT SELECT ON public.family_roster TO authenticated;

-- Check: the profile rule, and the roster's columns
SELECT policyname, cmd FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'profiles' AND cmd = 'SELECT';

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'family_roster'
ORDER BY ordinal_position;

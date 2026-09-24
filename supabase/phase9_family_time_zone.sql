-- ══════════════════════════════════════════════════
-- Phase 9 — The day belongs to the family
--
-- Every "which day is it" decision was made in Indian time, which is right
-- for a family in Chennai and wrong for one in New Jersey: at 8 pm on
-- Tuesday the app would already call it Wednesday. A Kutumbh now carries
-- its own time zone, set by the Prime Member, and the whole app follows it.
--
-- Days already logged are not re-dated. This decides what counts as today
-- from now on.
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

ALTER TABLE public.kutumbhs
  ADD COLUMN IF NOT EXISTS time_zone TEXT NOT NULL DEFAULT 'Asia/Kolkata';

-- A zone name, not free text ("Asia/Kolkata", "America/New_York").
-- The app offers a list; this only keeps nonsense out.
ALTER TABLE public.kutumbhs DROP CONSTRAINT IF EXISTS kutumbhs_time_zone_check;
ALTER TABLE public.kutumbhs ADD CONSTRAINT kutumbhs_time_zone_check
  CHECK (time_zone ~ '^[A-Za-z]+/[A-Za-z0-9_+-]+(/[A-Za-z0-9_+-]+)?$' OR time_zone = 'UTC');

-- The Prime Member looks after the family's settings
DROP POLICY IF EXISTS "kutumbhs_update_prime" ON public.kutumbhs;
CREATE POLICY "kutumbhs_update_prime" ON public.kutumbhs
  FOR UPDATE USING (id IN (SELECT public.my_prime_kutumbh_ids()))
  WITH CHECK (id IN (SELECT public.my_prime_kutumbh_ids()));

-- The roster already tells a member their family; the zone travels with it
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

-- Check: the column, its default, and every family's zone
SELECT k.name, k.time_zone FROM public.kutumbhs k ORDER BY k.name;

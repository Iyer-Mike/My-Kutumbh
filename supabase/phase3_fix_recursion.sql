-- ══════════════════════════════════════════════════════════
-- Phase 3 FIX — Resolve infinite recursion in kutumbh_members
-- Run in Supabase SQL Editor (my-kutumbh project)
-- ══════════════════════════════════════════════════════════

-- ── Step 1: Helper function (SECURITY DEFINER bypasses RLS) ──
-- When called inside a policy, this queries kutumbh_members
-- WITHOUT triggering RLS, breaking the recursive loop.
CREATE OR REPLACE FUNCTION public.my_kutumbh_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kutumbh_id FROM public.kutumbh_members WHERE user_id = auth.uid();
$$;


-- ── Step 2: Fix kutumbh_members policy (was self-referential) ──
DROP POLICY IF EXISTS "Members can view all in their kutumbh" ON public.kutumbh_members;
DROP POLICY IF EXISTS "Members can view their own membership"  ON public.kutumbh_members;

CREATE POLICY "Members can view all in their kutumbh"
  ON public.kutumbh_members FOR SELECT
  USING (
    kutumbh_id IN (SELECT public.my_kutumbh_ids())
  );


-- ── Step 3: Fix profiles policy ──────────────────────────────
DROP POLICY IF EXISTS "Users can view own and family profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view own profile"            ON public.profiles;

CREATE POLICY "Users can view own and family profiles"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT km.user_id
      FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );


-- ── Step 4: Fix meal_logs SELECT policy ──────────────────────
DROP POLICY IF EXISTS "meal_logs_select" ON public.meal_logs;

CREATE POLICY "meal_logs_select"
  ON public.meal_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT km.user_id
      FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );

-- ══════════════════════════════════════════════════════════
-- Phase 3 — Kutumbh Invite & Family Member View
-- Run in Supabase SQL Editor (my-kutumbh project)
-- ══════════════════════════════════════════════════════════

-- ── 1. Invite codes table ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.kutumbh_invites (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id   UUID        NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  invite_code  TEXT        NOT NULL UNIQUE,
  created_by   UUID        NOT NULL REFERENCES auth.users(id),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  used_count   INT         NOT NULL DEFAULT 0
);

ALTER TABLE public.kutumbh_invites ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can read an active invite (to validate a link)
CREATE POLICY "invites_select"
  ON public.kutumbh_invites FOR SELECT
  USING (auth.role() = 'authenticated' AND is_active = TRUE);

-- Only the kutumbh owner can create invites
CREATE POLICY "invites_insert"
  ON public.kutumbh_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.kutumbhs k
      WHERE k.id = kutumbh_id AND k.created_by = auth.uid()
    )
  );

-- Owner can deactivate their own invites
CREATE POLICY "invites_update"
  ON public.kutumbh_invites FOR UPDATE
  USING (created_by = auth.uid());


-- ── 2. SECURITY DEFINER helper (breaks RLS recursion) ───────
-- Queries kutumbh_members WITHOUT triggering its own RLS policy.
CREATE OR REPLACE FUNCTION public.my_kutumbh_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kutumbh_id FROM public.kutumbh_members WHERE user_id = auth.uid();
$$;


-- ── 3. Members see all members of their kutumbh ───────────
DROP POLICY IF EXISTS "Members can view their own membership"
  ON public.kutumbh_members;
DROP POLICY IF EXISTS "Members can view all in their kutumbh"
  ON public.kutumbh_members;

CREATE POLICY "Members can view all in their kutumbh"
  ON public.kutumbh_members FOR SELECT
  USING (
    kutumbh_id IN (SELECT public.my_kutumbh_ids())
  );


-- ── 4. Members see each other's profiles ─────────────────
DROP POLICY IF EXISTS "Users can view own profile"            ON public.profiles;
DROP POLICY IF EXISTS "Users can view own and family profiles" ON public.profiles;

CREATE POLICY "Users can view own and family profiles"
  ON public.profiles FOR SELECT
  USING (
    id = auth.uid()
    OR id IN (
      SELECT km.user_id FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );


-- ── 5. Members see each other's meal logs ────────────────
DROP POLICY IF EXISTS "meal_logs_select" ON public.meal_logs;

CREATE POLICY "meal_logs_select"
  ON public.meal_logs FOR SELECT
  USING (
    user_id = auth.uid()
    OR user_id IN (
      SELECT km.user_id FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );

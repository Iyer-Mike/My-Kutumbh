-- The open door.
--
-- Registration no longer waits for the Admin: a person with a verified email
-- is let in at once. What keeps it safe is elsewhere: the family's own six-digit
-- number, a small AI allowance for a new family, and a switch the Admin can
-- use afterwards to pause a family. The Admin Desk becomes a watch-post.
-- No function is dropped here; safe to run more than once.

-- ── Each family's AI allowance, and whether it is paused ─────────
-- A table of its own, because a Key Member may edit the family's row in
-- kutumbhs and must not be able to raise their own allowance.
CREATE TABLE IF NOT EXISTS public.kutumbh_limits (
  kutumbh_id      uuid PRIMARY KEY REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  ai_month_rupees numeric CHECK (ai_month_rupees IS NULL OR (ai_month_rupees >= 0 AND ai_month_rupees <= 5000)),
  blocked         boolean NOT NULL DEFAULT false,
  updated_at      timestamptz NOT NULL DEFAULT now(),
  updated_by      uuid
);
ALTER TABLE public.kutumbh_limits ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'kutumbh_limits' AND policyname = 'limits_read_own') THEN
    CREATE POLICY limits_read_own ON public.kutumbh_limits FOR SELECT TO authenticated
      USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));
  END IF;
END $$;

REVOKE ALL ON public.kutumbh_limits FROM anon, authenticated;
GRANT SELECT ON public.kutumbh_limits TO authenticated;

-- ── The Admin sets a family's allowance, or pauses the family ────
CREATE OR REPLACE FUNCTION public.admin_set_family_limit(p_kutumbh uuid, p_rupees numeric, p_blocked boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  INSERT INTO kutumbh_limits (kutumbh_id, ai_month_rupees, blocked, updated_at, updated_by)
  VALUES (p_kutumbh, p_rupees, COALESCE(p_blocked, false), now(), auth.uid())
  ON CONFLICT (kutumbh_id) DO UPDATE
    SET ai_month_rupees = EXCLUDED.ai_month_rupees,
        blocked         = EXCLUDED.blocked,
        updated_at      = now(),
        updated_by      = auth.uid();
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_set_family_limit(uuid, numeric, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_set_family_limit(uuid, numeric, boolean) TO authenticated;

-- ── Registering lets a person in ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.request_admission()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_now text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;

  SELECT status INTO v_now FROM app_admissions WHERE user_id = v_me;

  -- Someone the Admin turned away stays turned away
  IF v_now = 'declined' THEN RETURN v_now; END IF;
  IF v_now = 'admitted' THEN RETURN v_now; END IF;

  -- A family has invited this address: the six-digit number lets them in
  IF v_now IS NULL AND public.my_open_invite() IS NOT NULL THEN RETURN 'invited'; END IF;

  -- Everyone else is let in at once. decided_by stays empty: nobody decided.
  INSERT INTO app_admissions (user_id, status, decided_at)
  VALUES (v_me, 'admitted', now())
  ON CONFLICT (user_id) DO UPDATE SET status = 'admitted', decided_at = now()
    WHERE app_admissions.status = 'waiting';

  RETURN 'admitted';
END;
$$;

-- Anyone still in the old waiting room is let in now
UPDATE public.app_admissions SET status = 'admitted', decided_at = now() WHERE status = 'waiting';

-- ── The Admin is told of each newcomer, once ─────────────────────
CREATE OR REPLACE FUNCTION public.admin_notice_claim()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me   uuid := auth.uid();
  v_hit  boolean;
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;

  UPDATE app_admissions
     SET admin_told_at    = now(),
         admin_told_tries = admin_told_tries + 1
   WHERE user_id = v_me
     AND admin_told_at IS NULL
     AND admin_told_tries < 3
  RETURNING true INTO v_hit;

  RETURN COALESCE(v_hit, false);
END;
$$;

-- ── The desk: newcomers of the last two weeks ────────────────────
CREATE OR REPLACE FUNCTION public.admin_newcomers()
RETURNS TABLE (user_id uuid, full_name text, email text, status text, welcome text, joined timestamptz, family text, invited_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  RETURN QUERY
  SELECT a.user_id,
         COALESCE(p.full_name, u.raw_user_meta_data ->> 'full_name')::text,
         u.email::text,
         a.status::text,
         a.welcome::text,
         COALESCE(a.asked_at, a.decided_at),
         (SELECT k.name::text FROM kutumbh_members m JOIN kutumbhs k ON k.id = m.kutumbh_id
           WHERE m.user_id = a.user_id LIMIT 1),
         (SELECT k.name::text FROM kutumbh_invites i JOIN kutumbhs k ON k.id = i.kutumbh_id
           WHERE i.is_active AND i.expires_at > now() AND lower(i.invited_email) = lower(u.email)
           ORDER BY i.expires_at DESC LIMIT 1)
  FROM app_admissions a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE COALESCE(a.asked_at, a.decided_at) > now() - interval '14 days'
  ORDER BY COALESCE(a.asked_at, a.decided_at) DESC
  LIMIT 30;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_newcomers() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_newcomers() TO authenticated;

-- ── The desk: each family's allowance and whether it is paused ───
CREATE OR REPLACE FUNCTION public.admin_family_limits()
RETURNS TABLE (kutumbh_id uuid, ai_month_rupees numeric, blocked boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;
  RETURN QUERY SELECT l.kutumbh_id, l.ai_month_rupees, l.blocked FROM kutumbh_limits l;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_family_limits() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_family_limits() TO authenticated;

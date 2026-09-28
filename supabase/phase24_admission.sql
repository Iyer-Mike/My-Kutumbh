-- ═══════════════════════════════════════════════════════════════════
--  Phase 24 — being admitted to My Kutumbh
--
--  Two doors, each held by the right person:
--
--    · The ADMIN admits a household to the app. That is this file.
--    · A PRIME MEMBER admits people to their family, with the
--      six-digit number of phase 23.
--
--  How the first one goes:
--
--    1. The Admin writes to someone — from his own hand, in his own
--       mail — with a link and a passcode. The app sends nothing,
--       so nothing can fail to arrive.
--    2. They register, passcode in hand, and are told to wait.
--    3. The Admin approves them, with a note in his own words.
--    4. Only then does the app open, and onboarding begins.
--
--  Nobody reaches the app without passing step 3. A person waiting has
--  an account and nothing else: no family, no logging, no coach, and
--  no way to spend anyone's money.
--
--  The passcode lives a day, not ten minutes — a letter is read when
--  it is read, and the approval is what actually guards the door.
-- ═══════════════════════════════════════════════════════════════════

-- ── The passcodes the Admin hands out ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.app_invites (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  passcode      text NOT NULL,
  invited_email text,                       -- who it was written to, as a label
  note          text,                       -- why, for the Admin's own memory
  created_by    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at    timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL DEFAULT (now() + interval '24 hours'),
  is_active     boolean NOT NULL DEFAULT true,
  used_by       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  used_at       timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS app_invites_live_passcode
  ON public.app_invites (passcode) WHERE is_active;

ALTER TABLE public.app_invites ENABLE ROW LEVEL SECURITY;
-- Read and written only by the functions below.


-- ── Who has been admitted, who is waiting ─────────────────────────
CREATE TABLE IF NOT EXISTS public.app_admissions (
  user_id      uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'waiting',   -- waiting | admitted | declined
  asked_at     timestamptz NOT NULL DEFAULT now(),
  decided_at   timestamptz,
  decided_by   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  welcome      text,
  from_invite  uuid REFERENCES public.app_invites(id) ON DELETE SET NULL
);

ALTER TABLE public.app_admissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "See my own standing" ON public.app_admissions;
CREATE POLICY "See my own standing" ON public.app_admissions
  FOR SELECT USING (user_id = auth.uid());


-- ── Everyone already here was admitted long ago ───────────────────
--  Nobody using the app today should find themselves locked out by a
--  door that did not exist when they came in.
INSERT INTO public.app_admissions (user_id, status, asked_at, decided_at)
SELECT u.id, 'admitted', u.created_at, now()
FROM auth.users u
WHERE NOT EXISTS (SELECT 1 FROM public.app_admissions a WHERE a.user_id = u.id);


-- ── Registering with a passcode ───────────────────────────────────
DROP FUNCTION IF EXISTS public.claim_app_invite(text);

CREATE FUNCTION public.claim_app_invite(p_code text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_clean  text := upper(btrim(COALESCE(p_code, '')));
  v_invite public.app_invites%ROWTYPE;
  v_now    text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;

  SELECT status INTO v_now FROM app_admissions WHERE user_id = v_me;
  IF v_now IN ('admitted', 'waiting') THEN
    RETURN v_now;   -- already through this door, or already knocking
  END IF;

  SELECT * INTO v_invite FROM app_invites
  WHERE passcode = v_clean AND is_active LIMIT 1;

  IF NOT FOUND THEN RAISE EXCEPTION 'wrong_passcode'; END IF;
  IF v_invite.expires_at < now() THEN RAISE EXCEPTION 'passcode_expired'; END IF;

  UPDATE app_invites
     SET is_active = false, used_by = v_me, used_at = now()
   WHERE id = v_invite.id;

  INSERT INTO app_admissions (user_id, status, from_invite)
  VALUES (v_me, 'waiting', v_invite.id)
  ON CONFLICT (user_id) DO UPDATE SET status = 'waiting', from_invite = EXCLUDED.from_invite;

  RETURN 'waiting';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_app_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.claim_app_invite(text) TO authenticated;


-- ── The Admin writes a passcode ───────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_make_invite(text, text);

CREATE FUNCTION public.admin_make_invite(p_email text, p_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_code text;
  v_id   uuid;
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  -- Letters and digits, no O/0 or I/1 to be misread in a letter
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (floor(random() * 32) + 1)::int, 1), '')
    INTO v_code FROM generate_series(1, 8);

  INSERT INTO app_invites (passcode, invited_email, note, created_by)
  VALUES (v_code, lower(nullif(btrim(p_email), '')), nullif(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_id;

  RETURN json_build_object('passcode', v_code, 'id', v_id,
                           'expires_at', now() + interval '24 hours');
END;
$$;

REVOKE ALL ON FUNCTION public.admin_make_invite(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_make_invite(text, text) TO authenticated;


-- ── Who is waiting at the door ────────────────────────────────────
DROP FUNCTION IF EXISTS public.admin_waiting();

CREATE FUNCTION public.admin_waiting()
RETURNS TABLE (user_id uuid, full_name text, email text, asked_at timestamptz, invited_email text)
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
         a.asked_at,
         i.invited_email::text
  FROM app_admissions a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN profiles p ON p.id = a.user_id
  LEFT JOIN app_invites i ON i.id = a.from_invite
  WHERE a.status = 'waiting'
  ORDER BY a.asked_at;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_waiting() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_waiting() TO authenticated;


-- ── The Admin decides, in his own words ───────────────────────────
DROP FUNCTION IF EXISTS public.admin_decide(uuid, boolean, text);

CREATE FUNCTION public.admin_decide(p_user uuid, p_admit boolean, p_note text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  UPDATE app_admissions
     SET status     = CASE WHEN p_admit THEN 'admitted' ELSE 'declined' END,
         decided_at = now(),
         decided_by = auth.uid(),
         welcome    = nullif(btrim(p_note), '')
   WHERE user_id = p_user;

  IF NOT FOUND THEN RAISE EXCEPTION 'nobody_by_that_name'; END IF;

  -- They are told, in the app, the moment they next open it
  INSERT INTO notices (user_id, kind, title, body)
  VALUES (
    p_user,
    'admin',
    CASE WHEN p_admit THEN 'Welcome to My Kutumbh' ELSE 'About your registration' END,
    COALESCE(
      nullif(btrim(p_note), ''),
      CASE WHEN p_admit
        THEN 'Your registration has been approved. Set up your Kutumbh and begin.'
        ELSE 'Your registration was not approved this time.'
      END
    )
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_decide(uuid, boolean, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_decide(uuid, boolean, text) TO authenticated;


-- ── Check ─────────────────────────────────────────────────────────
SELECT status, count(*) FROM app_admissions GROUP BY status;

SELECT proname AS function_name FROM pg_proc
WHERE proname IN ('claim_app_invite', 'admin_make_invite', 'admin_waiting', 'admin_decide')
ORDER BY proname;

-- ═══════════════════════════════════════════════════════════════════
--  Phase 25 — the door can call out
--
--  Until now the Admin Desk was the only way to learn that somebody
--  had registered and was waiting: you had to think to look. That is
--  fine for a day and useless for a week. Somebody who registers on a
--  Tuesday evening should not sit behind the door until Friday because
--  nobody happened to open the page.
--
--  So the app sends ONE email, to the Admin's own address, saying that
--  someone is waiting. Nothing goes to the newcomer — there is still
--  no sending domain, so a letter to them would silently vanish, and
--  a message that may or may not arrive is worse than none.
--
--  Two rules shape what is below:
--
--    · It must fire once. A page that renders four times must not
--      send four emails, so the right to send is CLAIMED atomically
--      and the claim is written down.
--    · A claim that fails to turn into an email must be given back,
--      or the Admin would never hear about that person at all.
--
--  Giving a claim back is the one thing a waiting person could abuse:
--  call it by hand, reload, and the Admin is written to again. So the
--  tries are counted as well as the telling, and three is the most any
--  one person can ever cost him — enough for a mail server having a
--  bad afternoon, not enough to be a nuisance.
--
--  Also here: a second passcode written to the same address retires
--  the first. Two live passcodes for one person is two ways in where
--  the Admin believes there is one.
-- ═══════════════════════════════════════════════════════════════════

-- ── When the Admin was told ───────────────────────────────────────
ALTER TABLE public.app_admissions
  ADD COLUMN IF NOT EXISTS admin_told_at    timestamptz,
  ADD COLUMN IF NOT EXISTS admin_told_tries smallint NOT NULL DEFAULT 0;

-- Everyone already admitted is history; nobody needs announcing now.
UPDATE public.app_admissions
   SET admin_told_at = COALESCE(decided_at, asked_at)
 WHERE admin_told_at IS NULL AND status <> 'waiting';


-- ── May I be announced? ───────────────────────────────────────────
--  Returns true to exactly one caller, once. The UPDATE ... WHERE
--  admin_told_at IS NULL is the whole safeguard: two renders racing
--  each other, and only one row is touched. The try is counted in the
--  same statement, so the count cannot be dodged by crashing between.
DROP FUNCTION IF EXISTS public.admin_notice_claim();

CREATE FUNCTION public.admin_notice_claim()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_me   uuid := auth.uid();
  v_hit  boolean;
BEGIN
  IF v_me IS NULL THEN RETURN false; END IF;

  UPDATE app_admissions
     SET admin_told_at    = now(),
         admin_told_tries = admin_told_tries + 1
   WHERE user_id = v_me
     AND status = 'waiting'
     AND admin_told_at IS NULL
     AND admin_told_tries < 3
  RETURNING true INTO v_hit;

  RETURN COALESCE(v_hit, false);
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_notice_claim() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_notice_claim() TO authenticated;


-- ── That didn't work; put it back ─────────────────────────────────
--  The email was refused or timed out. Clearing the mark means the
--  next time this person opens the waiting room, the Admin is told.
--  The try already counted is not given back, which is what keeps this
--  from being a way to write to him over and over.
DROP FUNCTION IF EXISTS public.admin_notice_release();

CREATE FUNCTION public.admin_notice_release()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;

  UPDATE app_admissions
     SET admin_told_at = NULL
   WHERE user_id = auth.uid()
     AND status = 'waiting';
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_notice_release() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_notice_release() TO authenticated;


-- ── A fresh passcode retires the old one ──────────────────────────
--  Same function as phase 24, with one paragraph added. Written to an
--  address the Admin has written to before, the earlier live passcodes
--  for that address are closed first.
DROP FUNCTION IF EXISTS public.admin_make_invite(text, text);

CREATE FUNCTION public.admin_make_invite(p_email text, p_note text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_code  text;
  v_id    uuid;
  v_email text := lower(nullif(btrim(p_email), ''));
  v_old   int   := 0;
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  -- One way in at a time, per address
  IF v_email IS NOT NULL THEN
    UPDATE app_invites
       SET is_active = false
     WHERE is_active AND used_by IS NULL AND invited_email = v_email;
    GET DIAGNOSTICS v_old = ROW_COUNT;
  END IF;

  -- Letters and digits, no O/0 or I/1 to be misread in a letter
  SELECT string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789',
                           (floor(random() * 32) + 1)::int, 1), '')
    INTO v_code FROM generate_series(1, 8);

  INSERT INTO app_invites (passcode, invited_email, note, created_by)
  VALUES (v_code, v_email, nullif(btrim(p_note), ''), auth.uid())
  RETURNING id INTO v_id;

  RETURN json_build_object('passcode', v_code, 'id', v_id,
                           'retired', v_old,
                           'expires_at', now() + interval '24 hours');
END;
$fn$;

REVOKE ALL ON FUNCTION public.admin_make_invite(text, text) FROM public;
GRANT EXECUTE ON FUNCTION public.admin_make_invite(text, text) TO authenticated;


-- ── Close the two passcodes left lying about from yesterday ───────
UPDATE public.app_invites
   SET is_active = false
 WHERE is_active AND used_by IS NULL;


-- ── Check ─────────────────────────────────────────────────────────
SELECT status, count(*) AS people, count(admin_told_at) AS told,
       max(admin_told_tries) AS most_tries
FROM public.app_admissions GROUP BY status ORDER BY status;

SELECT count(*) AS live_passcodes FROM public.app_invites WHERE is_active;

SELECT proname AS function_name FROM pg_proc
WHERE proname IN ('admin_notice_claim', 'admin_notice_release', 'admin_make_invite')
ORDER BY proname;

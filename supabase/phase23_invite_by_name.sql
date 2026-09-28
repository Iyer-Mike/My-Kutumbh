-- ═══════════════════════════════════════════════════════════════════
--  Phase 23 — a link you can send, and a number you say out loud
--
--  Until now the link WAS the permission: whoever held it joined, and
--  the Prime Member found out by noticing a new face on the roster.
--  Links travel — forwarded in a family group, screenshotted, pasted —
--  and each copy opened another door into a household's kitchen.
--
--  Without a domain there is no email we can prove anything through.
--  So the proof moves to the channel that does work: the Prime Member
--  telling a person, in their own voice, a six-digit number.
--
--    · The LINK identifies the invitation. It is safe to forward,
--      because on its own it admits nobody.
--    · The NUMBER admits. Only the person who was told it can join.
--
--  Six digits is a million, which is only honest with guards:
--    five wrong tries and the invitation closes itself;
--    ten wrong tries by one account in an hour and they are stopped;
--    a number lives 24 hours, because a spoken number is used at once;
--    and it admits one person, then it is spent.
--
--  The family is told the moment somebody joins, and the Prime Member
--  can show anyone out. Those two are the safety net, not the lock.
-- ═══════════════════════════════════════════════════════════════════

-- ── The invitation gains a spoken number and a memory of tries ─────
ALTER TABLE public.kutumbh_invites
  ADD COLUMN IF NOT EXISTS join_code     text,
  ADD COLUMN IF NOT EXISTS invited_email text,
  ADD COLUMN IF NOT EXISTS attempts      integer NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.kutumbh_invites.join_code IS
  'Six digits, spoken aloud by the Prime Member. Never put in a URL.';
COMMENT ON COLUMN public.kutumbh_invites.invited_email IS
  'A label only, so the Prime Member remembers who a pending invitation was for.';

-- Two active invitations must never share a number
CREATE UNIQUE INDEX IF NOT EXISTS kutumbh_invites_live_code
  ON public.kutumbh_invites (join_code)
  WHERE is_active AND join_code IS NOT NULL;


-- ── Guessing is counted per person, not only per invitation ───────
--  A wrong number that matches nothing cannot increment an
--  invitation's counter, so the counting has to live somewhere else.
CREATE TABLE IF NOT EXISTS public.join_attempts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS join_attempts_person ON public.join_attempts (user_id, created_at DESC);

ALTER TABLE public.join_attempts ENABLE ROW LEVEL SECURITY;
-- Nobody reads or writes this directly; the function below does.


-- ── Joining, by number ────────────────────────────────────────────
DROP FUNCTION IF EXISTS public.join_with_code(text);

CREATE FUNCTION public.join_with_code(p_code text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user    uuid := auth.uid();
  v_clean   text := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');
  v_recent  int;
  v_invite  public.kutumbh_invites%ROWTYPE;
  v_current uuid;
  v_others  int;
  v_name    text;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  IF length(v_clean) <> 6 THEN
    RAISE EXCEPTION 'code_not_six_digits';
  END IF;

  -- One account cannot sit and guess
  SELECT count(*) INTO v_recent
  FROM join_attempts
  WHERE user_id = v_user AND created_at > now() - interval '1 hour';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'too_many_tries';
  END IF;

  SELECT * INTO v_invite
  FROM kutumbh_invites
  WHERE join_code = v_clean AND is_active
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO join_attempts (user_id) VALUES (v_user);
    RAISE EXCEPTION 'wrong_code';
  END IF;

  IF v_invite.expires_at < now() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  IF COALESCE(v_invite.attempts, 0) >= 5 THEN
    UPDATE kutumbh_invites SET is_active = false WHERE id = v_invite.id;
    RAISE EXCEPTION 'invite_closed_after_tries';
  END IF;

  -- Where they are now
  SELECT kutumbh_id INTO v_current FROM kutumbh_members WHERE user_id = v_user LIMIT 1;

  IF v_current = v_invite.kutumbh_id THEN
    RETURN json_build_object('kutumbh_id', v_current, 'status', 'already_member');
  END IF;

  IF v_current IS NOT NULL THEN
    SELECT count(*) INTO v_others
    FROM kutumbh_members WHERE kutumbh_id = v_current AND user_id <> v_user;

    -- A family with other people in it is not walked out of by typing a
    -- number. They leave it deliberately, with leave_kutumbh().
    IF v_others > 0 THEN
      RAISE EXCEPTION 'in_another_family';
    END IF;

    -- A household of one, founded while they waited, simply dissolves
    DELETE FROM kutumbh_members WHERE user_id = v_user AND kutumbh_id = v_current;
    DELETE FROM kutumbhs
     WHERE id = v_current
       AND NOT EXISTS (SELECT 1 FROM kutumbh_members WHERE kutumbh_id = v_current);
  END IF;

  INSERT INTO kutumbh_members (kutumbh_id, user_id, role)
  VALUES (v_invite.kutumbh_id, v_user, 'member')
  ON CONFLICT DO NOTHING;

  -- Spent: one number, one person
  UPDATE kutumbh_invites
     SET used_count = COALESCE(used_count, 0) + 1,
         is_active  = false
   WHERE id = v_invite.id;

  -- The family is told at once, rather than left to notice
  SELECT full_name INTO v_name FROM profiles WHERE id = v_user;

  INSERT INTO notices (kutumbh_id, kind, title, body)
  VALUES (
    v_invite.kutumbh_id,
    'member',
    COALESCE(v_name, 'Someone') || ' joined your Kutumbh',
    'They came in with the number you gave them. If this is not who you meant, the Prime '
      || 'Member can remove them from the family page.'
  );

  RETURN json_build_object(
    'kutumbh_id', v_invite.kutumbh_id,
    'status', CASE WHEN v_current IS NULL THEN 'joined' ELSE 'moved' END
  );
END;
$$;

REVOKE ALL ON FUNCTION public.join_with_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_with_code(text) TO authenticated;


-- ── A wrong number against a real invitation is counted on it too ──
DROP FUNCTION IF EXISTS public.note_wrong_code(text);

CREATE FUNCTION public.note_wrong_code(p_link text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN;
  END IF;
  UPDATE kutumbh_invites
     SET attempts = COALESCE(attempts, 0) + 1
   WHERE invite_code = upper(btrim(p_link)) AND is_active;
END;
$$;

REVOKE ALL ON FUNCTION public.note_wrong_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.note_wrong_code(text) TO authenticated;


-- ── The Prime Member can show someone out ─────────────────────────
DROP FUNCTION IF EXISTS public.remove_member(uuid);

CREATE FUNCTION public.remove_member(p_user uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_family uuid;
  v_name   text;
BEGIN
  SELECT kutumbh_id INTO v_family
  FROM kutumbh_members WHERE user_id = v_me AND role = 'owner' LIMIT 1;

  IF v_family IS NULL THEN RAISE EXCEPTION 'not_the_prime_member'; END IF;
  IF p_user = v_me THEN RAISE EXCEPTION 'cannot_remove_yourself'; END IF;
  IF NOT EXISTS (SELECT 1 FROM kutumbh_members WHERE kutumbh_id = v_family AND user_id = p_user) THEN
    RAISE EXCEPTION 'not_in_your_kutumbh';
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = p_user;

  DELETE FROM kutumbh_members WHERE kutumbh_id = v_family AND user_id = p_user;

  -- What they logged is theirs and goes with them; what they gave the
  -- family — dishes, the pantry, the shopping list — stays.

  INSERT INTO notices (kutumbh_id, kind, title, body)
  VALUES (v_family, 'member',
          COALESCE(v_name, 'A member') || ' is no longer in the Kutumbh',
          'Their own meals and reports remain theirs, and go with them.');

  INSERT INTO notices (user_id, kind, title, body)
  VALUES (p_user, 'member',
          'You are no longer in that Kutumbh',
          'Everything of yours — your meals, your reports, your account — is untouched. You can '
            || 'start a Kutumbh of your own, or accept another invitation.');

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.remove_member(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid) TO authenticated;


-- ── And a member can leave of their own accord ────────────────────
DROP FUNCTION IF EXISTS public.leave_kutumbh();

CREATE FUNCTION public.leave_kutumbh()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me     uuid := auth.uid();
  v_family uuid;
  v_role   text;
  v_others int;
  v_name   text;
BEGIN
  SELECT kutumbh_id, role INTO v_family, v_role
  FROM kutumbh_members WHERE user_id = v_me LIMIT 1;

  IF v_family IS NULL THEN RAISE EXCEPTION 'not_in_a_kutumbh'; END IF;

  SELECT count(*) INTO v_others
  FROM kutumbh_members WHERE kutumbh_id = v_family AND user_id <> v_me;

  -- The Prime Member does not walk away from a household that depends
  -- on them; the role is handed on first.
  IF v_role = 'owner' AND v_others > 0 THEN
    RAISE EXCEPTION 'hand_the_role_on_first';
  END IF;

  SELECT full_name INTO v_name FROM profiles WHERE id = v_me;

  DELETE FROM kutumbh_members WHERE kutumbh_id = v_family AND user_id = v_me;

  IF v_others = 0 THEN
    DELETE FROM kutumbhs WHERE id = v_family;   -- the last one out takes the house
  ELSE
    INSERT INTO notices (kutumbh_id, kind, title, body)
    VALUES (v_family, 'member',
            COALESCE(v_name, 'A member') || ' has left the Kutumbh',
            'They chose to leave. Their own meals and reports go with them.');
  END IF;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.leave_kutumbh() FROM public;
GRANT EXECUTE ON FUNCTION public.leave_kutumbh() TO authenticated;


-- ── Check ─────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'kutumbh_invites'
  AND column_name IN ('join_code', 'invited_email', 'attempts')
ORDER BY column_name;

SELECT proname AS function_name FROM pg_proc
WHERE proname IN ('join_with_code', 'note_wrong_code', 'remove_member', 'leave_kutumbh')
ORDER BY proname;

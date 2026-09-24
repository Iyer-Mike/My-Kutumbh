-- ══════════════════════════════════════════════════
-- Phase 8b — Joining a Kutumbh by invite, reliably
--
-- The invited person often confirms their email first, and the app used to
-- lose the invite on the way back. They then set up a family of their own
-- and were stuck: "You already belong to a Kutumbh", with no way out,
-- because nobody has permission to leave one.
--
-- This function does the whole join in one step, and lets a person leave a
-- Kutumbh that is only theirs (nobody else in it) in order to accept an
-- invite. It never lets anyone leave a family that has other members.
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.join_kutumbh_with_invite(p_code TEXT)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_invite   public.kutumbh_invites%ROWTYPE;
  v_current  UUID;
  v_others   INT;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not_signed_in';
  END IF;

  SELECT * INTO v_invite
  FROM public.kutumbh_invites
  WHERE invite_code = upper(btrim(p_code))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invite_not_found';
  END IF;
  IF NOT v_invite.is_active THEN
    RAISE EXCEPTION 'invite_inactive';
  END IF;
  IF v_invite.expires_at < NOW() THEN
    RAISE EXCEPTION 'invite_expired';
  END IF;

  SELECT kutumbh_id INTO v_current
  FROM public.kutumbh_members
  WHERE user_id = v_user
  LIMIT 1;

  IF v_current = v_invite.kutumbh_id THEN
    RETURN json_build_object('kutumbh_id', v_current, 'status', 'already_member');
  END IF;

  IF v_current IS NOT NULL THEN
    SELECT count(*) INTO v_others
    FROM public.kutumbh_members
    WHERE kutumbh_id = v_current AND user_id <> v_user;

    -- A family with other people in it is not something to walk out of by
    -- clicking a link; that needs a real conversation, not a function.
    IF v_others > 0 THEN
      RAISE EXCEPTION 'in_another_family';
    END IF;

    DELETE FROM public.kutumbh_members WHERE user_id = v_user AND kutumbh_id = v_current;
    DELETE FROM public.kutumbhs
     WHERE id = v_current
       AND NOT EXISTS (SELECT 1 FROM public.kutumbh_members WHERE kutumbh_id = v_current);
  END IF;

  INSERT INTO public.kutumbh_members (kutumbh_id, user_id, role)
  VALUES (v_invite.kutumbh_id, v_user, 'member')
  ON CONFLICT DO NOTHING;

  UPDATE public.kutumbh_invites
     SET used_count = COALESCE(used_count, 0) + 1
   WHERE id = v_invite.id;

  RETURN json_build_object(
    'kutumbh_id', v_invite.kutumbh_id,
    'status', CASE WHEN v_current IS NULL THEN 'joined' ELSE 'moved' END
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.join_kutumbh_with_invite(TEXT) TO authenticated;

-- Check: the function is there and callable
SELECT p.proname, pg_get_function_identity_arguments(p.oid) AS args, p.prosecdef AS security_definer
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'join_kutumbh_with_invite';

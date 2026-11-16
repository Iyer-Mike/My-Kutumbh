-- Onboarding repair.
--
-- Phase 29 rightly stopped any signed-in account from reading every invitation.
-- But the invitation page still read that table as the invited person, got nothing
-- back, and told every invitee "This invite link is not valid". From then on no
-- family member could join by link, and each fell into the Admin's waiting room.
--
-- This phase gives the page what it needs through narrow functions instead:
--   peek_invite(code)      what one invitation link says, to whoever holds the link
--   my_open_invite()       the open invitation addressed to the signed-in person, if any
--   request_admission()    an invited person is never queued for the Admin
--   join_with_code()       the number admits only the address the invitation was written to
--   admin_* functions      say who was invited by which family, so the desk reads true
-- Safe to run more than once.

-- ── What an invitation link says ─────────────────────────────────
DROP FUNCTION IF EXISTS public.peek_invite(text);

CREATE FUNCTION public.peek_invite(p_code text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
DECLARE
  v_inv  public.kutumbh_invites%ROWTYPE;
  v_name text;
  v_key  text;
BEGIN
  SELECT * INTO v_inv FROM kutumbh_invites WHERE invite_code = upper(btrim(COALESCE(p_code, ''))) LIMIT 1;
  IF NOT FOUND THEN RETURN json_build_object('state', 'none'); END IF;

  SELECT k.name INTO v_name FROM kutumbhs k WHERE k.id = v_inv.kutumbh_id;
  SELECT p.full_name INTO v_key
  FROM kutumbh_members m JOIN profiles p ON p.id = m.user_id
  WHERE m.kutumbh_id = v_inv.kutumbh_id AND m.role = 'owner' LIMIT 1;

  RETURN json_build_object(
    'state', CASE WHEN NOT v_inv.is_active THEN 'closed'
                  WHEN v_inv.expires_at < now() THEN 'expired'
                  ELSE 'open' END,
    'kutumbh_id', v_inv.kutumbh_id,
    'family', v_name,
    'key_member', v_key,
    'invited_email', v_inv.invited_email
  );
END;
$$;

REVOKE ALL ON FUNCTION public.peek_invite(text) FROM public;
GRANT EXECUTE ON FUNCTION public.peek_invite(text) TO anon, authenticated;


-- ── The open invitation addressed to me ──────────────────────────
DROP FUNCTION IF EXISTS public.my_open_invite();

CREATE FUNCTION public.my_open_invite()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT i.invite_code
  FROM kutumbh_invites i
  JOIN auth.users u ON u.id = auth.uid()
  WHERE i.is_active AND i.expires_at > now()
    AND i.invited_email IS NOT NULL
    AND lower(i.invited_email) = lower(u.email)
    AND NOT EXISTS (SELECT 1 FROM kutumbh_members m WHERE m.user_id = u.id AND m.kutumbh_id = i.kutumbh_id)
  ORDER BY i.expires_at DESC
  LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.my_open_invite() FROM public;
GRANT EXECUTE ON FUNCTION public.my_open_invite() TO authenticated;


-- ── An invited person does not wait for the Admin ────────────────
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

  -- Already admitted, already waiting, or turned away: leave it as it is.
  -- A declined person cannot knock again and reverse the Admin's decision.
  IF v_now IS NOT NULL THEN RETURN v_now; END IF;

  -- A family has invited this address: their Key Member vouches for them,
  -- and the six-digit number lets them in. Nothing for the Admin to decide.
  IF public.my_open_invite() IS NOT NULL THEN RETURN 'invited'; END IF;

  INSERT INTO app_admissions (user_id, status)
  VALUES (v_me, 'waiting')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN 'waiting';
END;
$$;


-- ── The number admits only the address it was written to ─────────
DROP FUNCTION IF EXISTS public.join_with_code(text);

CREATE FUNCTION public.join_with_code(p_code text)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $fn$
DECLARE
  v_user    uuid := auth.uid();
  v_clean   text := regexp_replace(COALESCE(p_code, ''), '\D', '', 'g');
  v_recent  int;
  v_invite  public.kutumbh_invites%ROWTYPE;
  v_current uuid;
  v_others  int;
  v_name    text;
  v_email   text;
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

  SELECT lower(email) INTO v_email FROM auth.users WHERE id = v_user;

  -- An invitation written to an address admits that address and no other.
  -- The page used to check this; now the door itself does.
  SELECT * INTO v_invite
  FROM kutumbh_invites
  WHERE join_code = v_clean AND is_active
    AND (invited_email IS NULL OR lower(invited_email) = v_email)
  ORDER BY expires_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    INSERT INTO join_attempts (user_id) VALUES (v_user);
    -- The right number, typed by an account with a different address
    IF EXISTS (SELECT 1 FROM kutumbh_invites
               WHERE join_code = v_clean AND is_active AND expires_at > now()) THEN
      RAISE EXCEPTION 'invite_other_email';
    END IF;
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

  -- Two doors, and this number opens both. The Admin vouches for a
  -- household; a Prime Member vouches for their own family, and that
  -- is vouching enough to be in the app.
  BEGIN
    INSERT INTO app_admissions (user_id, status, decided_at)
    VALUES (v_user, 'admitted', now())
    ON CONFLICT (user_id) DO UPDATE SET status = 'admitted', decided_at = now();
  EXCEPTION WHEN undefined_table THEN
    NULL;
  END;

  -- ── The guardian's consent, carried in ──
  --
  -- Written against the GUARDIAN's name with the child in
  -- on_behalf_of, and stamped with the moment the guardian agreed
  -- rather than the moment the child typed a number. The fingerprints
  -- are whatever the guardian was actually shown.
  IF v_invite.for_minor
     AND v_invite.guardian_id IS NOT NULL
     AND v_invite.guardian_docs IS NOT NULL THEN
    BEGIN
      INSERT INTO consents (user_id, doc, version, fingerprint, agreed_at, on_behalf_of)
      SELECT v_invite.guardian_id,
             d ->> 'doc',
             d ->> 'version',
             d ->> 'fingerprint',
             COALESCE(v_invite.guardian_agreed_at, now()),
             v_user
      FROM jsonb_array_elements(v_invite.guardian_docs) AS d
      ON CONFLICT DO NOTHING;
    EXCEPTION WHEN undefined_table THEN
      NULL;   -- before phase 26; joining must not fail for it
    END;
  END IF;

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
    'They came in with the number you gave them. If this is not who you meant, the Key '
      || 'Member can remove them from the family page.'
  );

  RETURN json_build_object(
    'kutumbh_id', v_invite.kutumbh_id,
    'status', CASE WHEN v_current IS NULL THEN 'joined' ELSE 'moved' END
  );
END;
$fn$;

REVOKE ALL ON FUNCTION public.join_with_code(text) FROM public;
GRANT EXECUTE ON FUNCTION public.join_with_code(text) TO authenticated;


-- ── The Admin Desk: who was invited by which family ──────────────
DROP FUNCTION IF EXISTS public.admin_recent_decisions();

CREATE FUNCTION public.admin_recent_decisions()
RETURNS TABLE (user_id uuid, full_name text, email text, status text, welcome text, decided_at timestamptz, has_family boolean, invited_by text)
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
         a.decided_at,
         EXISTS (SELECT 1 FROM kutumbh_members m WHERE m.user_id = a.user_id),
         (SELECT k.name::text FROM kutumbh_invites i JOIN kutumbhs k ON k.id = i.kutumbh_id
           WHERE i.is_active AND i.expires_at > now() AND lower(i.invited_email) = lower(u.email)
           ORDER BY i.expires_at DESC LIMIT 1)
  FROM app_admissions a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.status IN ('admitted', 'declined')
    AND a.decided_at > now() - interval '14 days'
    AND a.decided_by IS NOT NULL
  ORDER BY a.decided_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recent_decisions() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_recent_decisions() TO authenticated;


DROP FUNCTION IF EXISTS public.admin_stranded_people();

CREATE FUNCTION public.admin_stranded_people()
RETURNS TABLE (full_name text, email text, joined timestamptz, confirmed boolean, standing text, invited_by text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'Not permitted'; END IF;

  RETURN QUERY
  SELECT
    COALESCE(p.full_name, u.raw_user_meta_data ->> 'full_name', '(no name given)')::text,
    u.email::text,
    u.created_at,
    (u.email_confirmed_at IS NOT NULL),
    COALESCE(a.status, 'none')::text,
    (SELECT k.name::text FROM kutumbh_invites i JOIN kutumbhs k ON k.id = i.kutumbh_id
      WHERE i.is_active AND i.expires_at > now() AND lower(i.invited_email) = lower(u.email)
      ORDER BY i.expires_at DESC LIMIT 1)
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  LEFT JOIN app_admissions a ON a.user_id = u.id
  WHERE NOT EXISTS (SELECT 1 FROM kutumbh_members m WHERE m.user_id = u.id)
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_stranded_people() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_stranded_people() TO authenticated;


-- ── Wrong numbers are counted ────────────────────────────────────
-- join_with_code writes a row to join_attempts and then raises, which undoes the
-- row: the "ten tries an hour" limit never counted anything. The app now records
-- the wrong try in a call of its own, after the refusal.
DROP FUNCTION IF EXISTS public.note_join_attempt();

CREATE FUNCTION public.note_join_attempt()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN RETURN; END IF;
  INSERT INTO join_attempts (user_id) VALUES (auth.uid());
END;
$$;

REVOKE ALL ON FUNCTION public.note_join_attempt() FROM public;
GRANT EXECUTE ON FUNCTION public.note_join_attempt() TO authenticated;

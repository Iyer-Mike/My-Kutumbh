-- ═══════════════════════════════════════════════════════════════════
--  Phase 27 — a child cannot agree, so somebody agrees for them
--
--  Phase 26 asks every member to accept two documents. A twelve-year-
--  old whose mother logs the family's meals cannot meaningfully accept
--  anything, and India's DPDP Act says as much: a child's data needs
--  the consent of a parent or guardian, not of the child.
--
--  So the asking moves to the person who can answer. When a Prime
--  Member invites someone under eighteen, they say so, and they accept
--  the two documents on that child's behalf. It is recorded against
--  their own name, with the child named in on_behalf_of, so the record
--  always says WHO agreed and FOR WHOM.
--
--  The fingerprints come from the app and travel on the invitation.
--  The database does not know what the documents say — it should not —
--  it only carries what the guardian was shown, so that a consent
--  given for a child is pinned to exact wording just as their own is.
--
--  Also here: consents were left with UPDATE and DELETE granted to
--  anon and authenticated, by Supabase's defaults rather than by
--  anyone's decision. Row-level security already refuses both, there
--  being no policy for either — but on a consent record the permission
--  should not be sitting there at all.
-- ═══════════════════════════════════════════════════════════════════

-- ── An invitation can say who it is for ───────────────────────────
ALTER TABLE public.kutumbh_invites
  ADD COLUMN IF NOT EXISTS for_minor          boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS guardian_id        uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS guardian_agreed_at timestamptz,
  ADD COLUMN IF NOT EXISTS guardian_docs      jsonb;

COMMENT ON COLUMN public.kutumbh_invites.for_minor IS
  'The Prime Member said this invitation is for someone under eighteen.';
COMMENT ON COLUMN public.kutumbh_invites.guardian_docs IS
  'What the guardian was shown when they agreed: [{doc, version, fingerprint}]. '
  'Written by the app, which owns the documents; carried, not interpreted, here.';


-- ── Taking that consent with them when they join ──────────────────
--  Same function as phase 23, with one paragraph added near the end.
--  The whole body is repeated because a function cannot be amended in
--  place, and half a definition in a file is worse than none.
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
    'They came in with the number you gave them. If this is not who you meant, the Prime '
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


-- ── A consent is not something to be edited ───────────────────────
--  Row-level security already refuses these: there is no UPDATE policy
--  and no DELETE policy on the table. This removes the permission as
--  well, so the promise does not rest on a policy alone.
REVOKE UPDATE, DELETE, TRUNCATE ON public.consents FROM anon, authenticated;


-- ── Check ─────────────────────────────────────────────────────────
SELECT column_name FROM information_schema.columns
WHERE table_name = 'kutumbh_invites' AND column_name LIKE 'guardian%' OR
      (table_name = 'kutumbh_invites' AND column_name = 'for_minor')
ORDER BY column_name;

SELECT grantee, string_agg(privilege_type, ', ' ORDER BY privilege_type) AS still_granted
FROM information_schema.role_table_grants
WHERE table_name = 'consents' AND grantee IN ('anon', 'authenticated')
GROUP BY grantee ORDER BY grantee;

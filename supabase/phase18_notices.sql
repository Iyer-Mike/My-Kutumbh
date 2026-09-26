-- ═══════════════════════════════════════════════════════════════════
--  Phase 18 — notices
--
--  One table carries two kinds of message:
--
--    · what the Admin writes to a Kutumbh — addressed to the family,
--      landing with the Prime Member, who may write back;
--    · what the app itself needs a family to know — the month's
--      allowance running low, a member joining, dishes waiting.
--
--  Addressed to a family, not to a person: kutumbh_id is who it is
--  for. A notice may also name one member, for the things that are
--  only theirs.
--
--  This is the only channel that works today. Push does not exist and
--  email leaves through an unverified sender, so a notice in the app
--  is the one message that certainly arrives.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS notices (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id  uuid REFERENCES kutumbhs(id) ON DELETE CASCADE,
  user_id     uuid REFERENCES auth.users(id) ON DELETE CASCADE,  -- when it is one person's alone
  kind        text NOT NULL DEFAULT 'admin',   -- admin | reply | allowance | member | dishes
  title       text NOT NULL,
  body        text,
  action_href text,
  from_admin  boolean NOT NULL DEFAULT false,
  author_id   uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  read_at     timestamptz
);

CREATE INDEX IF NOT EXISTS notices_family_time ON notices (kutumbh_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notices_person_time ON notices (user_id, created_at DESC);

ALTER TABLE notices ENABLE ROW LEVEL SECURITY;

-- A family reads what is addressed to the family, and each member what
-- is addressed to them. Nothing else, ever.
DROP POLICY IF EXISTS "Read my Kutumbh's notices" ON notices;
CREATE POLICY "Read my Kutumbh's notices" ON notices
  FOR SELECT USING (
    user_id = auth.uid()
    OR kutumbh_id IN (SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid())
  );

-- Marking one as read is the only change a family may make.
DROP POLICY IF EXISTS "Mark my notices read" ON notices;
CREATE POLICY "Mark my notices read" ON notices
  FOR UPDATE USING (
    user_id = auth.uid()
    OR kutumbh_id IN (SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid())
  );

-- Nobody writes a notice directly. They come from the two functions
-- below, which decide who is allowed to say what.


-- ── The Admin writes to one Kutumbh ──────────────────────────────

DROP FUNCTION IF EXISTS admin_write_to_kutumbh(uuid, text, text);

CREATE FUNCTION admin_write_to_kutumbh(p_kutumbh uuid, p_title text, p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  new_id uuid;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;
  IF coalesce(trim(p_title), '') = '' THEN
    RAISE EXCEPTION 'A notice needs something to say';
  END IF;

  INSERT INTO notices (kutumbh_id, kind, title, body, from_admin, author_id)
  VALUES (p_kutumbh, 'admin', trim(p_title), nullif(trim(p_body), ''), true, auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION admin_write_to_kutumbh(uuid, text, text) FROM public;
GRANT EXECUTE ON FUNCTION admin_write_to_kutumbh(uuid, text, text) TO authenticated;


-- ── A Prime Member writes back ───────────────────────────────────
-- Only the Prime Member, and only for their own family. The reply is
-- stored against the same Kutumbh, so the thread stays whole.

DROP FUNCTION IF EXISTS reply_to_admin(text);

CREATE FUNCTION reply_to_admin(p_body text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_kutumbh uuid;
  new_id uuid;
BEGIN
  SELECT kutumbh_id INTO my_kutumbh
  FROM kutumbh_members
  WHERE user_id = auth.uid() AND role = 'owner'
  LIMIT 1;

  IF my_kutumbh IS NULL THEN
    RAISE EXCEPTION 'Only the Prime Member may write back';
  END IF;
  IF coalesce(trim(p_body), '') = '' THEN
    RAISE EXCEPTION 'A reply needs something in it';
  END IF;

  INSERT INTO notices (kutumbh_id, kind, title, body, from_admin, author_id)
  VALUES (my_kutumbh, 'reply', 'Reply from the Kutumbh', trim(p_body), false, auth.uid())
  RETURNING id INTO new_id;

  RETURN new_id;
END;
$$;

REVOKE ALL ON FUNCTION reply_to_admin(text) FROM public;
GRANT EXECUTE ON FUNCTION reply_to_admin(text) TO authenticated;


-- ── What the Admin Desk shows: every thread, newest first ────────

DROP FUNCTION IF EXISTS admin_notices();

CREATE FUNCTION admin_notices()
RETURNS TABLE (
  id           uuid,
  kutumbh_id   uuid,
  kutumbh_name text,
  title        text,
  body         text,
  from_admin   boolean,
  created_at   timestamptz,
  read_at      timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  RETURN QUERY
  SELECT n.id, n.kutumbh_id, k.name::text, n.title, n.body, n.from_admin, n.created_at, n.read_at
  FROM notices n
  LEFT JOIN kutumbhs k ON k.id = n.kutumbh_id
  WHERE n.kind IN ('admin', 'reply')
  ORDER BY n.created_at DESC
  LIMIT 100;
END;
$$;

REVOKE ALL ON FUNCTION admin_notices() FROM public;
GRANT EXECUTE ON FUNCTION admin_notices() TO authenticated;


-- ── Check: the table, its two rules, and the three functions ─────
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'notices' ORDER BY policyname;

SELECT proname AS function_name
FROM pg_proc
WHERE proname IN ('admin_write_to_kutumbh', 'reply_to_admin', 'admin_notices')
ORDER BY proname;

SELECT count(*) AS notices_so_far FROM notices;

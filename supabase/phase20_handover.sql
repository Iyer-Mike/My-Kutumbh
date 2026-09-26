-- ═══════════════════════════════════════════════════════════════════
--  Phase 20 — the family outlives any one member
--
--  Today a Kutumbh has exactly one Prime Member and no way to change
--  who it is. If that person loses their phone, falls ill, or simply
--  stops using the app, the family is stuck for ever: no one can
--  complete a dish, invite a cousin, or look after the household.
--
--  Three ways the role moves, as the family decided:
--
--    · handed over — the Prime Member gives it to any member, at will;
--    · claimed — after seven days of silence, any member may take it;
--    · taken back — the one who lost it that way may reclaim it with
--      one tap when they return, for a fortnight afterwards.
--
--  Every change is written down, so nobody has to remember what
--  happened or take anyone's word for it.
-- ═══════════════════════════════════════════════════════════════════

-- ── When someone was last here ───────────────────────────────────
-- Silence is the trigger for a claim, so silence has to be measurable.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Everyone who exists today is treated as present today, so that
-- running this file cannot hand anybody's role away tomorrow morning.
UPDATE profiles SET last_seen_at = now() WHERE last_seen_at IS NULL;


-- ── What happened, and when ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS prime_changes (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id uuid NOT NULL REFERENCES kutumbhs(id) ON DELETE CASCADE,
  from_user  uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  to_user    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  kind       text NOT NULL,   -- handover | claim | reclaim
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS prime_changes_family ON prime_changes (kutumbh_id, created_at DESC);

ALTER TABLE prime_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "See my Kutumbh's changes" ON prime_changes;
CREATE POLICY "See my Kutumbh's changes" ON prime_changes
  FOR SELECT USING (
    kutumbh_id IN (SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid())
  );
-- Nobody writes here directly; the three functions below do.


-- ── Handed over, deliberately ────────────────────────────────────

DROP FUNCTION IF EXISTS hand_over_prime(uuid);

CREATE FUNCTION hand_over_prime(p_to uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_kutumbh uuid;
  to_name    text;
  from_name  text;
BEGIN
  SELECT kutumbh_id INTO my_kutumbh
  FROM kutumbh_members
  WHERE user_id = auth.uid() AND role = 'owner'
  LIMIT 1;

  IF my_kutumbh IS NULL THEN
    RAISE EXCEPTION 'Only the Prime Member can hand the role on';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM kutumbh_members
    WHERE kutumbh_id = my_kutumbh AND user_id = p_to
  ) THEN
    RAISE EXCEPTION 'That person is not in your Kutumbh';
  END IF;

  IF p_to = auth.uid() THEN
    RAISE EXCEPTION 'You already have it';
  END IF;

  UPDATE kutumbh_members SET role = 'member'
  WHERE kutumbh_id = my_kutumbh AND user_id = auth.uid();

  UPDATE kutumbh_members SET role = 'owner'
  WHERE kutumbh_id = my_kutumbh AND user_id = p_to;

  INSERT INTO prime_changes (kutumbh_id, from_user, to_user, kind)
  VALUES (my_kutumbh, auth.uid(), p_to, 'handover');

  SELECT full_name INTO to_name   FROM profiles WHERE id = p_to;
  SELECT full_name INTO from_name FROM profiles WHERE id = auth.uid();

  INSERT INTO notices (kutumbh_id, kind, title, body)
  VALUES (
    my_kutumbh,
    'member',
    coalesce(to_name, 'A member') || ' now looks after the Kutumbh',
    coalesce(from_name, 'The previous Prime Member') || ' has passed the role on. '
      || 'The Prime Member completes the family dishes, invites new members, and keeps the family photograph.'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION hand_over_prime(uuid) FROM public;
GRANT EXECUTE ON FUNCTION hand_over_prime(uuid) TO authenticated;


-- ── Claimed, after a week of silence ─────────────────────────────

DROP FUNCTION IF EXISTS claim_prime();

CREATE FUNCTION claim_prime()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  my_kutumbh uuid;
  old_prime  uuid;
  quiet_since timestamptz;
  my_name    text;
  old_name   text;
BEGIN
  SELECT kutumbh_id INTO my_kutumbh
  FROM kutumbh_members
  WHERE user_id = auth.uid()
  LIMIT 1;

  IF my_kutumbh IS NULL THEN
    RAISE EXCEPTION 'You are not in a Kutumbh';
  END IF;

  SELECT m.user_id INTO old_prime
  FROM kutumbh_members m
  WHERE m.kutumbh_id = my_kutumbh AND m.role = 'owner'
  LIMIT 1;

  IF old_prime = auth.uid() THEN
    RAISE EXCEPTION 'You already have it';
  END IF;

  SELECT last_seen_at INTO quiet_since FROM profiles WHERE id = old_prime;

  IF quiet_since IS NOT NULL AND quiet_since > now() - interval '7 days' THEN
    RAISE EXCEPTION 'The Prime Member has been here within the week';
  END IF;

  UPDATE kutumbh_members SET role = 'member'
  WHERE kutumbh_id = my_kutumbh AND user_id = old_prime;

  UPDATE kutumbh_members SET role = 'owner'
  WHERE kutumbh_id = my_kutumbh AND user_id = auth.uid();

  INSERT INTO prime_changes (kutumbh_id, from_user, to_user, kind)
  VALUES (my_kutumbh, old_prime, auth.uid(), 'claim');

  SELECT full_name INTO my_name  FROM profiles WHERE id = auth.uid();
  SELECT full_name INTO old_name FROM profiles WHERE id = old_prime;

  -- The family is told...
  INSERT INTO notices (kutumbh_id, kind, title, body)
  VALUES (
    my_kutumbh,
    'member',
    coalesce(my_name, 'A member') || ' is looking after the Kutumbh',
    'The app had not been opened by ' || coalesce(old_name, 'the Prime Member')
      || ' for a week, so ' || coalesce(my_name, 'another member') || ' has taken the role. '
      || 'It can be given back at any time.'
  );

  -- ...and the one who lost it is told, personally, with a way back
  INSERT INTO notices (kutumbh_id, user_id, kind, title, body)
  VALUES (
    my_kutumbh,
    old_prime,
    'member',
    'You were away, so ' || coalesce(my_name, 'another member') || ' took over',
    'The Kutumbh needs someone able to complete dishes and invite members, so after a week '
      || 'the role passed on. Nothing of yours has changed, and you can take it back with one tap '
      || 'for the next fortnight.'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION claim_prime() FROM public;
GRANT EXECUTE ON FUNCTION claim_prime() TO authenticated;


-- ── Taken back, by the one who was away ──────────────────────────

DROP FUNCTION IF EXISTS reclaim_prime();

CREATE FUNCTION reclaim_prime()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  c          record;
  my_name    text;
BEGIN
  -- Only a role taken by silence may be taken back, and only within a
  -- fortnight. A role handed over deliberately stays handed over.
  SELECT * INTO c
  FROM prime_changes
  WHERE from_user = auth.uid()
    AND kind = 'claim'
    AND created_at > now() - interval '14 days'
  ORDER BY created_at DESC
  LIMIT 1;

  IF c IS NULL THEN
    RAISE EXCEPTION 'There is nothing to take back';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM kutumbh_members
    WHERE kutumbh_id = c.kutumbh_id AND user_id = c.to_user AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'The role has moved on since';
  END IF;

  UPDATE kutumbh_members SET role = 'member'
  WHERE kutumbh_id = c.kutumbh_id AND user_id = c.to_user;

  UPDATE kutumbh_members SET role = 'owner'
  WHERE kutumbh_id = c.kutumbh_id AND user_id = auth.uid();

  INSERT INTO prime_changes (kutumbh_id, from_user, to_user, kind)
  VALUES (c.kutumbh_id, c.to_user, auth.uid(), 'reclaim');

  SELECT full_name INTO my_name FROM profiles WHERE id = auth.uid();

  INSERT INTO notices (kutumbh_id, kind, title, body)
  VALUES (
    c.kutumbh_id,
    'member',
    coalesce(my_name, 'The previous Prime Member') || ' is back',
    'They have taken the role again. Thank you to whoever held it in the meantime.'
  );

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION reclaim_prime() FROM public;
GRANT EXECUTE ON FUNCTION reclaim_prime() TO authenticated;


-- ── Check: the column, the table, and the three functions ───────
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'last_seen_at';

SELECT proname AS function_name FROM pg_proc
WHERE proname IN ('hand_over_prime', 'claim_prime', 'reclaim_prime')
ORDER BY proname;

SELECT count(*) AS changes_so_far FROM prime_changes;

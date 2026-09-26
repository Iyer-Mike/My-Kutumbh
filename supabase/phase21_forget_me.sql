-- ═══════════════════════════════════════════════════════════════════
--  Phase 21 — leaving, and what survives it
--
--  Two things, and the first is a fault that exists today.
--
--  ── The fault ──────────────────────────────────────────────────
--  kutumbhs.created_by cascades. Delete the account that created a
--  family — from this app, or from the Supabase dashboard by accident
--  — and the whole Kutumbh goes with it: every membership, every
--  family dish, the pantry, the shopping list. One person leaving
--  would empty the house for everyone still living in it.
--
--  A family is not owned by whoever happened to sign up first. The
--  record of who founded it is worth keeping; the family's existence
--  must not depend on their account.
--
--  ── The walls ──────────────────────────────────────────────────
--  Six columns refuse deletion outright: a person who ever added a
--  food item, sent an invitation, updated the pantry or asked for
--  something on the shopping list cannot be removed at all. Each is a
--  small question about what outlives someone leaving.
--
--    · what they added to the shared food list — stays, unsigned
--    · what they updated in the pantry or the pools — stays, unsigned
--    · what they asked for on the shopping list — stays, unsigned
--    · invitations they sent — go with them
--    · what their questions cost — stays, as accounting, unsigned
--
--  The family keeps the thing; the name simply detaches.
-- ═══════════════════════════════════════════════════════════════════

DO $$
DECLARE
  t text; c text; rule text; cname text;
BEGIN
  FOR t, c, rule IN
    SELECT * FROM (VALUES
      ('kutumbhs',        'created_by',   'SET NULL'),   -- the family outlives its founder
      ('food_items',      'created_by',   'SET NULL'),
      ('meal_pools',      'updated_by',   'SET NULL'),
      ('pantry_items',    'updated_by',   'SET NULL'),
      ('shopping_items',  'requested_by', 'SET NULL'),
      ('shopping_items',  'bought_by',    'SET NULL'),
      ('ai_spend',        'user_id',      'SET NULL'),   -- money spent was spent
      ('kutumbh_invites', 'created_by',   'CASCADE')     -- their invitations die with them
    ) AS v(t, c, rule)
  LOOP
    -- Find whatever the constraint is actually called, rather than
    -- guessing at a naming convention
    SELECT con.conname INTO cname
    FROM pg_constraint con
    JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = ANY (con.conkey)
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
      AND con.conrelid = format('public.%I', t)::regclass
      AND a.attname = c
    LIMIT 1;

    IF cname IS NOT NULL THEN
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, cname);
    END IF;

    IF rule = 'SET NULL' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', t, c);
    END IF;

    EXECUTE format(
      'ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES auth.users(id) ON DELETE %s',
      t, t || '_' || c || '_user_fkey', c, rule
    );
  END LOOP;
END $$;


-- ── Being forgotten ─────────────────────────────────────────────
--
--  A person may take themselves out of the app entirely. What is
--  theirs goes: their profile, every meal they logged, their medical
--  records, their photographs, the notices addressed to them.
--
--  What is the family's stays, unsigned.
--
--  One refusal: the Prime Member of a family with other people in it
--  must hand the role on first. Otherwise leaving would strand the
--  household — which is the very thing phase 20 was written to stop.

DROP FUNCTION IF EXISTS forget_me();

CREATE FUNCTION forget_me()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  me        uuid := auth.uid();
  my_k      uuid;
  my_role   text;
  others    integer;
BEGIN
  IF me IS NULL THEN
    RAISE EXCEPTION 'Not signed in';
  END IF;

  SELECT kutumbh_id, role INTO my_k, my_role
  FROM kutumbh_members WHERE user_id = me LIMIT 1;

  IF my_k IS NOT NULL THEN
    SELECT count(*) INTO others
    FROM kutumbh_members WHERE kutumbh_id = my_k AND user_id <> me;

    IF my_role = 'owner' AND others > 0 THEN
      RAISE EXCEPTION 'Hand the Kutumbh on first';
    END IF;
  END IF;

  -- Theirs, and not to be left behind
  DELETE FROM medical_records WHERE user_id = me;
  DELETE FROM meal_logs       WHERE user_id = me;
  DELETE FROM meal_plans      WHERE user_id = me;
  DELETE FROM notices         WHERE user_id = me;

  -- The last one out takes the house with them; anyone else leaves it standing
  IF my_k IS NOT NULL AND others = 0 THEN
    DELETE FROM kutumbhs WHERE id = my_k;
  END IF;

  DELETE FROM auth.users WHERE id = me;
  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION forget_me() FROM public;
GRANT EXECUTE ON FUNCTION forget_me() TO authenticated;


-- ── Check: no wall is left standing, and the family is safe ─────
SELECT c.conrelid::regclass::text AS table_name,
       a.attname                  AS column_name,
       CASE c.confdeltype
         WHEN 'a' THEN 'NO ACTION'  WHEN 'r' THEN 'RESTRICT'
         WHEN 'c' THEN 'CASCADE'    WHEN 'n' THEN 'SET NULL'
         WHEN 'd' THEN 'SET DEFAULT'
       END                        AS on_delete
FROM pg_constraint c
JOIN unnest(c.conkey) AS k(attnum) ON true
JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = k.attnum
WHERE c.contype = 'f' AND c.confrelid = 'auth.users'::regclass
  AND c.conrelid::regclass::text NOT LIKE 'auth.%'
ORDER BY 3, 1;

SELECT proname AS function_name FROM pg_proc WHERE proname = 'forget_me';

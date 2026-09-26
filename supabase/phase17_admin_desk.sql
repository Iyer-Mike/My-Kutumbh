-- ═══════════════════════════════════════════════════════════════════
--  Phase 17 — the Admin Desk
--
--  One person runs this app. They need to see that it is working:
--  which households are alive, what is being spent, what is breaking.
--
--  The rule this whole file obeys:
--
--      You see THAT things happened. You never see WHAT they were.
--
--  So: counts, timings and totals leave these functions. Never a food
--  name, a lab value, a question asked of the coach, or a photograph.
--  The guarantee lives here, in the database, rather than in the good
--  intentions of the page that calls it.
--
--  There is no service-role key anywhere in the app. Each function
--  below sees everything, checks who is asking, and returns only the
--  aggregate. An ordinary member calling one gets an error, not data.
-- ═══════════════════════════════════════════════════════════════════

-- ── Who may ask ──────────────────────────────────────────────────
-- Named by email rather than a pasted UUID, so it is legible and
-- survives a database restore. Changing it is a migration, on purpose.

CREATE OR REPLACE FUNCTION is_app_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE id = auth.uid()
        AND lower(email) = 'iyer.mike@gmail.com'
    )
    -- ...or the database owner, working in the SQL editor. They can
    -- already read every table directly, so this grants nothing new,
    -- and it lets the desk be tested from there.
    --
    -- session_user, not current_user: inside a SECURITY DEFINER
    -- function current_user is the function's owner for EVERY caller,
    -- which would have handed the desk to the whole world.
    OR session_user IN ('postgres', 'supabase_admin');
$$;

REVOKE ALL ON FUNCTION is_app_admin() FROM public;
GRANT EXECUTE ON FUNCTION is_app_admin() TO authenticated;


-- ── The households ───────────────────────────────────────────────
-- Who joined, who leads, when anyone last opened it, how much they
-- have logged, what they have spent. Nothing of what they logged.

DROP FUNCTION IF EXISTS admin_households();

CREATE FUNCTION admin_households()
RETURNS TABLE (
  kutumbh_id    uuid,
  name          text,
  prime_name    text,
  members       integer,
  created_at    timestamptz,
  last_logged   date,          -- the last day this family logged any food
  logs_7d       integer,
  logs_total    integer,
  spend_month   numeric
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
  SELECT
    k.id,
    k.name::text,
    (SELECT p.full_name::text
       FROM kutumbh_members m2
       JOIN profiles p ON p.id = m2.user_id
      WHERE m2.kutumbh_id = k.id AND m2.role = 'owner'
      LIMIT 1),
    (SELECT count(*)::integer FROM kutumbh_members m3 WHERE m3.kutumbh_id = k.id),
    k.created_at,
    (SELECT max(l.logged_date)
       FROM meal_logs l
      WHERE l.user_id IN (SELECT m4.user_id FROM kutumbh_members m4 WHERE m4.kutumbh_id = k.id)),
    (SELECT count(*)::integer
       FROM meal_logs l2
      WHERE l2.user_id IN (SELECT m5.user_id FROM kutumbh_members m5 WHERE m5.kutumbh_id = k.id)
        AND l2.logged_date >= (current_date - 7)),
    (SELECT count(*)::integer
       FROM meal_logs l3
      WHERE l3.user_id IN (SELECT m6.user_id FROM kutumbh_members m6 WHERE m6.kutumbh_id = k.id)),
    (SELECT COALESCE(sum(s.cost_rupees), 0)
       FROM ai_spend s
      WHERE s.kutumbh_id = k.id
        AND s.created_at >= date_trunc('month', now()))
  FROM kutumbhs k
  ORDER BY k.created_at;
END;
$$;

REVOKE ALL ON FUNCTION admin_households() FROM public;
GRANT EXECUTE ON FUNCTION admin_households() TO authenticated;


-- ── The money, by feature ────────────────────────────────────────

DROP FUNCTION IF EXISTS admin_spend_by_feature();

CREATE FUNCTION admin_spend_by_feature()
RETURNS TABLE (feature text, calls integer, spend_month numeric)
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
  SELECT s.feature::text, count(*)::integer, COALESCE(sum(s.cost_rupees), 0)
  FROM ai_spend s
  WHERE s.created_at >= date_trunc('month', now())
  GROUP BY s.feature
  ORDER BY 3 DESC;
END;
$$;

REVOKE ALL ON FUNCTION admin_spend_by_feature() FROM public;
GRANT EXECUTE ON FUNCTION admin_spend_by_feature() TO authenticated;


-- ── People who signed up but belong to no family yet ─────────────
-- The quietest failure there is: someone joined and got stuck.

DROP FUNCTION IF EXISTS admin_stranded_people();

CREATE FUNCTION admin_stranded_people()
RETURNS TABLE (full_name text, joined timestamptz, confirmed boolean)
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
  SELECT
    COALESCE(p.full_name, '(no name given)')::text,
    u.created_at,
    (u.email_confirmed_at IS NOT NULL)
  FROM auth.users u
  LEFT JOIN profiles p ON p.id = u.id
  WHERE NOT EXISTS (SELECT 1 FROM kutumbh_members m WHERE m.user_id = u.id)
  ORDER BY u.created_at DESC;
END;
$$;

REVOKE ALL ON FUNCTION admin_stranded_people() FROM public;
GRANT EXECUTE ON FUNCTION admin_stranded_people() TO authenticated;


-- ── Invitations ──────────────────────────────────────────────────

DROP FUNCTION IF EXISTS admin_invites();

CREATE FUNCTION admin_invites()
RETURNS TABLE (kutumbh_name text, made timestamptz, expires timestamptz, active boolean, used integer)
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
  SELECT k.name::text, i.expires_at - interval '7 days', i.expires_at, i.is_active, i.used_count
  FROM kutumbh_invites i
  JOIN kutumbhs k ON k.id = i.kutumbh_id
  ORDER BY i.expires_at DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION admin_invites() FROM public;
GRANT EXECUTE ON FUNCTION admin_invites() TO authenticated;


-- ── Check: the five functions exist ──────────────────────────────
SELECT proname AS function_name
FROM pg_proc
WHERE proname IN ('is_app_admin', 'admin_households', 'admin_spend_by_feature',
                  'admin_stranded_people', 'admin_invites')
ORDER BY proname;

-- ── Check: the desk itself, as seen from here ────────────────────
SELECT * FROM admin_households();
SELECT * FROM admin_stranded_people();

-- ═══════════════════════════════════════════════════════════════════
--  Phase 22 — when something breaks, somebody should know
--
--  Today a failure is seen by one family and nobody else. The bill
--  reader refuses, a page falls over, a key expires — and unless that
--  family happens to mention it, it goes unnoticed for ever.
--
--  What is written down: where it broke, what the machine said, and
--  which household it happened to.
--
--  What is never written down: anything the family typed, ate,
--  uploaded or asked. A fault log is exactly the place where private
--  things accumulate unnoticed, so the rule is the same as the Admin
--  Desk's — THAT it happened, never WHAT it was about.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS app_faults (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  where_at   text NOT NULL,                  -- 'read-bill', 'coach', '/family', ...
  message    text NOT NULL,                  -- the machine's own words, trimmed
  status     integer,
  kutumbh_id uuid REFERENCES kutumbhs(id) ON DELETE SET NULL,
  user_id    uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS app_faults_time ON app_faults (created_at DESC);

ALTER TABLE app_faults ENABLE ROW LEVEL SECURITY;

-- Anyone signed in may report their own trouble. Nobody may read the
-- log except through the Admin Desk's function below — a member has no
-- business seeing another household's failures.
DROP POLICY IF EXISTS "Report my own trouble" ON app_faults;
CREATE POLICY "Report my own trouble" ON app_faults
  FOR INSERT WITH CHECK (user_id = auth.uid() OR user_id IS NULL);


-- ── What the Admin Desk shows ────────────────────────────────────
-- Grouped, because twenty of the same fault is one problem, not twenty.

DROP FUNCTION IF EXISTS admin_faults();

CREATE FUNCTION admin_faults()
RETURNS TABLE (
  where_at     text,
  message      text,
  status       integer,
  times        integer,
  households   integer,
  last_seen    timestamptz
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
  SELECT f.where_at,
         f.message,
         f.status,
         count(*)::integer,
         count(DISTINCT f.kutumbh_id)::integer,
         max(f.created_at)
  FROM app_faults f
  WHERE f.created_at >= now() - interval '30 days'
  GROUP BY f.where_at, f.message, f.status
  ORDER BY max(f.created_at) DESC
  LIMIT 50;
END;
$$;

REVOKE ALL ON FUNCTION admin_faults() FROM public;
GRANT EXECUTE ON FUNCTION admin_faults() TO authenticated;


-- ── Check: the table, its one rule, and the function ────────────
SELECT policyname, cmd FROM pg_policies WHERE tablename = 'app_faults';

SELECT proname AS function_name FROM pg_proc WHERE proname = 'admin_faults';

SELECT count(*) AS faults_so_far FROM app_faults;

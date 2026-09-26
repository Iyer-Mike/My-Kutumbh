-- ═══════════════════════════════════════════════════════════════════
--  Phase 15 — the ceiling above the ceilings
--
--  Each Kutumbh has ₹500 a month. But one card pays for every Kutumbh,
--  and ten families would be ₹5,000. This is the whole app's own limit.
--
--  A member may not read another family's spending — and must still be
--  able to learn that the app as a whole has reached its month. So the
--  sum is given by a function that sees everything and returns a single
--  number, and nothing else.
-- ═══════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION ai_spend_month_total()
RETURNS bigint
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(paise), 0)::bigint
  FROM ai_spend
  WHERE created_at >= date_trunc('month', now());
$$;

REVOKE ALL ON FUNCTION ai_spend_month_total() FROM public;
GRANT EXECUTE ON FUNCTION ai_spend_month_total() TO authenticated;

-- ── Check: the function answers, and gives back one plain number ──
SELECT ai_spend_month_total() AS paise_spent_by_everyone_this_month;

-- ═══════════════════════════════════════════════════════════════════
--  Phase 16 — the ledger keeps rupees
--
--  The paisa is no longer used in accounting, so the ledger is kept in
--  rupees. The fraction stays — one reading of a bill costs about ₹1.30,
--  and rounding every call to a whole rupee would drift badly over a
--  few hundred of them — but it is a fraction OF A RUPEE, and nothing
--  the family sees is ever counted in paise.
--
--  numeric, not a floating point number: money must add up exactly.
--
--  Safe to run more than once, and safe whether or not an earlier
--  attempt got part of the way.
-- ═══════════════════════════════════════════════════════════════════

ALTER TABLE ai_spend ADD COLUMN IF NOT EXISTS cost_rupees numeric(12,4) NOT NULL DEFAULT 0;

-- Carry across whatever was already recorded — only if the old column
-- is still there, so a second run cannot fail on a column that has gone
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'ai_spend' AND column_name = 'paise'
  ) THEN
    UPDATE ai_spend SET cost_rupees = paise / 100.0
    WHERE cost_rupees = 0 AND paise IS NOT NULL AND paise <> 0;

    ALTER TABLE ai_spend DROP COLUMN paise;
  END IF;
END $$;

-- The app's own total, now in rupees. A function cannot change the type
-- it returns, so the old one goes first.
DROP FUNCTION IF EXISTS ai_spend_month_total();

CREATE FUNCTION ai_spend_month_total()
RETURNS numeric
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT COALESCE(SUM(cost_rupees), 0)::numeric
  FROM ai_spend
  WHERE created_at >= date_trunc('month', now());
$$;

REVOKE ALL ON FUNCTION ai_spend_month_total() FROM public;
GRANT EXECUTE ON FUNCTION ai_spend_month_total() TO authenticated;

-- ── Check: one row, cost_rupees, numeric, scale 4 — and no paise ──
SELECT column_name, data_type, numeric_scale
FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'ai_spend'
  AND column_name IN ('cost_rupees', 'paise');

-- ── Check: this month across every family, about 3.00 ──
SELECT ai_spend_month_total() AS rupees_spent_by_everyone_this_month;

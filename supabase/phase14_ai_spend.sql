-- ═══════════════════════════════════════════════════════════════════
--  Phase 14 — what the thinking costs
--
--  Every call to the AI is written down here: who asked, which family
--  they belong to, which feature, how many tokens, and what it cost in
--  paise. From this one table the app answers two questions before it
--  spends anything: has this family spent its month, and has this
--  person spent their day.
--
--  Money is kept in paise (whole numbers), never rupees as a decimal.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS ai_spend (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kutumbh_id         uuid REFERENCES kutumbhs(id) ON DELETE SET NULL,
  feature            text NOT NULL,          -- coach | read-bill | analyze-food | estimate-dish | parse-medical-report
  model              text NOT NULL,
  input_tokens       integer NOT NULL DEFAULT 0,
  output_tokens      integer NOT NULL DEFAULT 0,
  cache_read_tokens  integer NOT NULL DEFAULT 0,
  cache_write_tokens integer NOT NULL DEFAULT 0,
  paise              integer NOT NULL DEFAULT 0,
  created_at         timestamptz NOT NULL DEFAULT now()
);

-- The two questions the gate asks, made cheap
CREATE INDEX IF NOT EXISTS ai_spend_family_time ON ai_spend (kutumbh_id, created_at DESC);
CREATE INDEX IF NOT EXISTS ai_spend_person_time ON ai_spend (user_id, created_at DESC);

ALTER TABLE ai_spend ENABLE ROW LEVEL SECURITY;

-- A family may see what the family has spent — no more, and never
-- another family's. Nobody may edit or erase what was spent.
DROP POLICY IF EXISTS "See my Kutumbh's spending" ON ai_spend;
CREATE POLICY "See my Kutumbh's spending" ON ai_spend
  FOR SELECT USING (
    user_id = auth.uid()
    OR kutumbh_id IN (SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid())
  );

DROP POLICY IF EXISTS "Record my own spending" ON ai_spend;
CREATE POLICY "Record my own spending" ON ai_spend
  FOR INSERT WITH CHECK (user_id = auth.uid());

-- ── Check: the table, its rules, and that it is empty and ready ──
SELECT policyname, cmd FROM pg_policies
WHERE tablename = 'ai_spend' ORDER BY policyname;

SELECT count(*) AS rows_so_far FROM ai_spend;

-- ══════════════════════════════════════════════════════════════════
-- Fix 1: kutumbh_members — let members see the full family roster
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view kutumbh roster" ON kutumbh_members;
CREATE POLICY "Members can view kutumbh roster"
  ON kutumbh_members FOR SELECT
  USING (
    kutumbh_id IN (
      SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid()
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- Fix 2: profiles — let members see fellow family members' profiles
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view family profiles" ON profiles;
CREATE POLICY "Members can view family profiles"
  ON profiles FOR SELECT
  USING (
    id IN (
      SELECT user_id FROM kutumbh_members
      WHERE kutumbh_id IN (
        SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- Fix 3: meal_logs — let members see family meal logs (for family page)
-- ══════════════════════════════════════════════════════════════════
DROP POLICY IF EXISTS "Members can view family meal logs" ON meal_logs;
CREATE POLICY "Members can view family meal logs"
  ON meal_logs FOR SELECT
  USING (
    user_id IN (
      SELECT user_id FROM kutumbh_members
      WHERE kutumbh_id IN (
        SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid()
      )
    )
  );

-- ══════════════════════════════════════════════════════════════════
-- Fix 4: meal_plans — add kutumbh_id for family-wide sharing
-- ══════════════════════════════════════════════════════════════════
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS kutumbh_id UUID REFERENCES kutumbhs(id);

-- Drop old single-user ALL policy and replace with family-aware ones
DROP POLICY IF EXISTS "Users manage their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Family members can view meal plans"    ON meal_plans;
DROP POLICY IF EXISTS "Family members can insert meal plans"  ON meal_plans;
DROP POLICY IF EXISTS "Users can delete their own meal plans" ON meal_plans;
DROP POLICY IF EXISTS "Users can update their own meal plans" ON meal_plans;

CREATE POLICY "Family members can view meal plans"
  ON meal_plans FOR SELECT
  USING (
    user_id = auth.uid()
    OR kutumbh_id IN (
      SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Family members can insert meal plans"
  ON meal_plans FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    AND (
      kutumbh_id IS NULL
      OR kutumbh_id IN (
        SELECT kutumbh_id FROM kutumbh_members WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Users can delete their own meal plans"
  ON meal_plans FOR DELETE
  USING (user_id = auth.uid());

CREATE POLICY "Users can update their own meal plans"
  ON meal_plans FOR UPDATE
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

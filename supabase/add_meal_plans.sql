-- ══════════════════════════════════════════════════════════════
-- Meal Plans table
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS meal_plans (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       UUID        REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  planned_date  DATE        NOT NULL,
  meal_slot     TEXT        NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner','other')),
  food_name     TEXT        NOT NULL,
  quantity_g    NUMERIC     DEFAULT 1,
  quantity_unit TEXT        DEFAULT 'serving',
  food_item_id  UUID        REFERENCES food_items(id),
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE meal_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own meal plans"
  ON meal_plans FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

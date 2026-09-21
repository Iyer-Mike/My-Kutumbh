-- Add calories column to meal_plans so planned items can store kcal
ALTER TABLE meal_plans ADD COLUMN IF NOT EXISTS calories NUMERIC;

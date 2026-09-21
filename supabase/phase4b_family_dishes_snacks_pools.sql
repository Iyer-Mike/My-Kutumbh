-- ══════════════════════════════════════════════════════════════════
-- Phase 4b — Family Dishes, two snack slots, named family pools
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ══════════════════════════════════════════════════════════════════


-- ── Helper: kutumbhs where the caller is the Prime Member ─────────
-- SECURITY DEFINER so policies can use it without RLS recursion
-- (same pattern as my_kutumbh_ids()).
CREATE OR REPLACE FUNCTION public.my_prime_kutumbh_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT kutumbh_id FROM public.kutumbh_members
  WHERE user_id = auth.uid() AND role = 'owner';
$$;


-- ══════════════════════════════════════════════════════════════════
-- 1. Family Dishes — family-only rows in food_items
-- ══════════════════════════════════════════════════════════════════
-- kutumbh_id NULL  = shared catalogue food (visible to everyone)
-- kutumbh_id set   = a Family Dish, visible only to that family
-- needs_review     = added by a member, waiting for the Prime Member
--                    to fill in nutrition / ingredients / preparation
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS kutumbh_id   UUID REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at   TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS food_items_kutumbh_idx ON public.food_items (kutumbh_id);

DROP POLICY IF EXISTS "food_items_select"        ON public.food_items;
DROP POLICY IF EXISTS "family_dish_insert"       ON public.food_items;
DROP POLICY IF EXISTS "family_dish_update_prime" ON public.food_items;

-- Everyone sees the shared catalogue; Family Dishes only within the family
CREATE POLICY "food_items_select" ON public.food_items
  FOR SELECT USING (
    auth.role() = 'authenticated'
    AND (kutumbh_id IS NULL OR kutumbh_id IN (SELECT public.my_kutumbh_ids()))
  );

-- Any member can add a Family Dish for their own family
CREATE POLICY "family_dish_insert" ON public.food_items
  FOR INSERT WITH CHECK (
    kutumbh_id IN (SELECT public.my_kutumbh_ids())
    AND created_by = auth.uid()
  );

-- Only the Prime Member can complete / edit a Family Dish
CREATE POLICY "family_dish_update_prime" ON public.food_items
  FOR UPDATE
  USING      (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));


-- ── Estimated nutrition on logs ───────────────────────────────────
-- TRUE when the kcal on a log came from a category average or a photo
-- estimate rather than the dish's real values.
ALTER TABLE public.meal_logs
  ADD COLUMN IF NOT EXISTS nutrition_estimated BOOLEAN NOT NULL DEFAULT FALSE;


-- ── Replace estimates once the Prime Member completes a dish ──────
-- Members' logs are only writable by their owners, so this runs as
-- SECURITY DEFINER and checks the caller is that family's Prime Member.
-- Recalculates every log of the dish that was estimated or had no kcal.
CREATE OR REPLACE FUNCTION public.apply_family_dish(dish_id UUID)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  d  public.food_items%ROWTYPE;
  n  INTEGER;
BEGIN
  SELECT * INTO d FROM public.food_items WHERE id = dish_id;

  IF d.id IS NULL
     OR d.kutumbh_id IS NULL
     OR d.kutumbh_id NOT IN (SELECT public.my_prime_kutumbh_ids()) THEN
    RAISE EXCEPTION 'Only the Prime Member can apply this dish';
  END IF;

  IF d.calories IS NULL THEN
    RETURN 0;
  END IF;

  -- grams = quantity when the unit is grams, otherwise quantity × serving weight
  UPDATE public.meal_logs ml SET
    calories  = ROUND(
                  (CASE WHEN ml.quantity_unit = 'g' THEN ml.quantity_g
                        ELSE ml.quantity_g * COALESCE(d.serving_weight_g, 100) END)
                  * d.calories / 100),
    protein_g = CASE WHEN d.protein_g IS NULL THEN NULL ELSE ROUND(
                  (CASE WHEN ml.quantity_unit = 'g' THEN ml.quantity_g
                        ELSE ml.quantity_g * COALESCE(d.serving_weight_g, 100) END)
                  * d.protein_g / 100, 1) END,
    nutrition_estimated = FALSE
  WHERE ml.food_item_id = dish_id
    AND (ml.calories IS NULL OR ml.nutrition_estimated)
    AND ml.user_id IN (SELECT user_id FROM public.kutumbh_members WHERE kutumbh_id = d.kutumbh_id);
  GET DIAGNOSTICS n = ROW_COUNT;

  RETURN n;
END;
$$;

GRANT EXECUTE ON FUNCTION public.apply_family_dish(UUID) TO authenticated;


-- ══════════════════════════════════════════════════════════════════
-- 2. Meal slots — Morning Snack + Evening Snack replace "Other"
-- ══════════════════════════════════════════════════════════════════
-- Drop whatever CHECK constraint currently restricts meal_slot
-- (its auto-generated name isn't guaranteed), then add the new list.
-- 'other' stays allowed only so the old app version keeps working
-- during the few minutes before the new code deploys.
DO $$
DECLARE c RECORD;
BEGIN
  FOR c IN
    SELECT conrelid::regclass AS tbl, conname
    FROM pg_constraint
    WHERE contype = 'c'
      AND conrelid IN ('public.meal_logs'::regclass, 'public.meal_plans'::regclass)
      AND pg_get_constraintdef(oid) ILIKE '%meal_slot%'
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', c.tbl, c.conname);
  END LOOP;
END $$;

ALTER TABLE public.meal_logs ADD CONSTRAINT meal_logs_meal_slot_check
  CHECK (meal_slot IN ('breakfast','morning_snack','lunch','evening_snack','dinner','other'));

ALTER TABLE public.meal_plans ADD CONSTRAINT meal_plans_meal_slot_check
  CHECK (meal_slot IN ('breakfast','morning_snack','lunch','evening_snack','dinner','other'));

-- Move existing "Other" entries by time of day (India time):
-- before 4 pm → Morning Snack, 4 pm onwards → Evening Snack
UPDATE public.meal_logs
SET meal_slot = CASE
  WHEN EXTRACT(HOUR FROM (logged_at AT TIME ZONE 'Asia/Kolkata')) < 16 THEN 'morning_snack'
  ELSE 'evening_snack' END
WHERE meal_slot = 'other';

UPDATE public.meal_plans
SET meal_slot = CASE
  WHEN EXTRACT(HOUR FROM (created_at AT TIME ZONE 'Asia/Kolkata')) < 16 THEN 'morning_snack'
  ELSE 'evening_snack' END
WHERE meal_slot = 'other';


-- ══════════════════════════════════════════════════════════════════
-- 3. Named family pools — "Family Lunch", renamable per day
-- ══════════════════════════════════════════════════════════════════
-- A row exists only when someone renames the pool; otherwise the app
-- shows the default "Family <Slot>".
CREATE TABLE IF NOT EXISTS public.meal_pools (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id   UUID        NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  planned_date DATE        NOT NULL,
  meal_slot    TEXT        NOT NULL,
  name         TEXT        NOT NULL,
  updated_by   UUID        REFERENCES auth.users(id),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (kutumbh_id, planned_date, meal_slot)
);

ALTER TABLE public.meal_pools ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Family can view pools"   ON public.meal_pools;
DROP POLICY IF EXISTS "Family can name pools"   ON public.meal_pools;
DROP POLICY IF EXISTS "Family can rename pools" ON public.meal_pools;

CREATE POLICY "Family can view pools" ON public.meal_pools
  FOR SELECT USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));

CREATE POLICY "Family can name pools" ON public.meal_pools
  FOR INSERT WITH CHECK (
    kutumbh_id IN (SELECT public.my_kutumbh_ids()) AND updated_by = auth.uid()
  );

CREATE POLICY "Family can rename pools" ON public.meal_pools
  FOR UPDATE
  USING      (kutumbh_id IN (SELECT public.my_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_kutumbh_ids()) AND updated_by = auth.uid());

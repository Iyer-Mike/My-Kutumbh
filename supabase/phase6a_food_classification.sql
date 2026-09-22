-- ══════════════════════════════════════════════════
-- Phase 6a — Three-layer food classification
--   A. Cuisine  →  B. Diet  →  C. Dish type (food_items.category)
-- Run this FIRST, then phase6b_recipes_part1, part2, part3.
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- 1. New columns on food_items
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS cuisine   TEXT,
  ADD COLUMN IF NOT EXISTS diet      TEXT,
  ADD COLUMN IF NOT EXISTS is_jain   BOOLEAN,
  ADD COLUMN IF NOT EXISTS meal_hint TEXT[],
  ADD COLUMN IF NOT EXISTS recipe_id INTEGER;

-- 2. Recipes (copied from Project Ahara, now kept in My Kutumbh)
CREATE TABLE IF NOT EXISTS public.recipes (
  id                  INTEGER PRIMARY KEY,
  name                TEXT NOT NULL,
  source_cuisine      TEXT,
  cuisine             TEXT NOT NULL,
  diet                TEXT NOT NULL,
  is_jain             BOOLEAN NOT NULL DEFAULT FALSE,
  dish_type           TEXT NOT NULL,
  serves              TEXT,
  prep_time           TEXT,
  cook_time           TEXT,
  blurb               TEXT,
  tip                 TEXT,
  badge               TEXT,
  tags                TEXT[],
  ingredients         TEXT[],
  method              TEXT[],
  meal_hint           TEXT[],
  serving_unit        TEXT,
  serving_weight_g    NUMERIC(7,1),
  -- nutrition for ONE serving
  kcal                NUMERIC(7,1),
  protein_g           NUMERIC(7,2),
  carbs_g             NUMERIC(7,2),
  fat_g               NUMERIC(7,2),
  fibre_g             NUMERIC(7,2),
  iron_mg             NUMERIC(7,2),
  calcium_mg          NUMERIC(8,2),
  vit_b12_mcg         NUMERIC(7,2),
  sodium_mg           NUMERIC(8,2),
  nutrition_estimated BOOLEAN NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE public.recipes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "recipes_select" ON public.recipes;
CREATE POLICY "recipes_select" ON public.recipes FOR SELECT USING (auth.role() = 'authenticated');

CREATE UNIQUE INDEX IF NOT EXISTS food_items_recipe_id_key ON public.food_items (recipe_id);
CREATE INDEX IF NOT EXISTS food_items_filter_idx ON public.food_items (cuisine, diet, category);

-- 3. Old categories → new dish types (Family Dishes too)
ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_category_check;
UPDATE public.food_items SET category = CASE category
  WHEN 'grain' THEN 'staple'
  WHEN 'legume' THEN 'dal'
  WHEN 'vegetable' THEN 'side'
  WHEN 'fruit' THEN 'fruit'
  WHEN 'dairy' THEN 'dairy'
  WHEN 'snack' THEN 'snack'
  WHEN 'sweet' THEN 'dessert'
  WHEN 'spice' THEN 'chutney'
  WHEN 'beverage' THEN 'drink'
  WHEN 'other' THEN 'extras'
  ELSE category END
WHERE category IN ('grain', 'legume', 'vegetable', 'fruit', 'dairy', 'snack', 'sweet', 'spice', 'beverage', 'other');

-- 4. The shared list, dish by dish
UPDATE public.food_items f SET
  cuisine = v.cuisine, diet = v.diet, category = v.dish_type, is_jain = v.jain, meal_hint = v.meals
FROM (VALUES
  ('White Rice (cooked)', 'pan_indian', 'vegan', 'staple', true, ARRAY['lunch','dinner']::text[]),
  ('Brown Rice (cooked)', 'pan_indian', 'vegan', 'staple', true, ARRAY['lunch','dinner']::text[]),
  ('Chapati / Roti', 'pan_indian', 'vegan', 'staple', true, ARRAY['lunch','dinner']::text[]),
  ('Idli', 'south_indian', 'vegan', 'main', true, ARRAY['breakfast','dinner']::text[]),
  ('Dosa (plain)', 'south_indian', 'vegan', 'main', true, ARRAY['breakfast','dinner']::text[]),
  ('Wheat Dosa', 'south_indian', 'vegan', 'main', true, ARRAY['breakfast','dinner']::text[]),
  ('Uttapam', 'south_indian', 'vegan', 'main', false, ARRAY['breakfast','dinner']::text[]),
  ('Upma', 'south_indian', 'vegan', 'main', false, ARRAY['breakfast','dinner']::text[]),
  ('Ven Pongal', 'south_indian', 'veg', 'main', true, ARRAY['breakfast']::text[]),
  ('Poha (cooked)', 'west_indian', 'vegan', 'main', false, ARRAY['breakfast','snack']::text[]),
  ('Toor Dal (cooked)', 'pan_indian', 'vegan', 'dal', true, ARRAY['lunch','dinner']::text[]),
  ('Moong Dal (cooked)', 'pan_indian', 'vegan', 'dal', true, ARRAY['lunch','dinner']::text[]),
  ('Chana Dal (cooked)', 'pan_indian', 'vegan', 'dal', true, ARRAY['lunch','dinner']::text[]),
  ('Urad Dal (cooked)', 'pan_indian', 'vegan', 'dal', true, ARRAY['lunch','dinner']::text[]),
  ('Sambar', 'south_indian', 'vegan', 'dal', false, ARRAY['lunch','dinner']::text[]),
  ('Rasam', 'south_indian', 'vegan', 'dal', false, ARRAY['lunch','dinner']::text[]),
  ('Rajma (cooked)', 'north_indian', 'vegan', 'curry', false, ARRAY['lunch','dinner']::text[]),
  ('Chickpeas (cooked)', 'pan_indian', 'vegan', 'curry', false, ARRAY['lunch','dinner']::text[]),
  ('Drumstick / Moringa', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Ash Gourd', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Ridge Gourd', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Bitter Gourd', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Raw Banana (cooked)', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Spinach (cooked)', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Cabbage (cooked)', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Tomato', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Tomato (cooked)', 'pan_indian', 'vegan', 'side', true, ARRAY['lunch','dinner']::text[]),
  ('Brinjal / Eggplant', 'pan_indian', 'vegan', 'side', false, ARRAY['lunch','dinner']::text[]),
  ('Yam / Suran (cooked)', 'pan_indian', 'vegan', 'side', false, ARRAY['lunch','dinner']::text[]),
  ('Potato (cooked)', 'pan_indian', 'vegan', 'side', false, ARRAY['lunch','dinner']::text[]),
  ('Carrot (cooked)', 'pan_indian', 'vegan', 'side', false, ARRAY['lunch','dinner']::text[]),
  ('Tomato (raw)', 'pan_indian', 'vegan', 'salad', true, ARRAY['lunch','dinner']::text[]),
  ('Cucumber (raw)', 'pan_indian', 'vegan', 'salad', true, ARRAY['lunch','dinner']::text[]),
  ('Onion (raw)', 'pan_indian', 'vegan', 'salad', false, ARRAY['lunch','dinner']::text[]),
  ('Carrot (raw)', 'pan_indian', 'vegan', 'salad', false, ARRAY['lunch','dinner']::text[]),
  ('Mixed Green Salad', 'pan_indian', 'vegan', 'salad', false, ARRAY['lunch','dinner']::text[]),
  ('Sprouts (raw)', 'pan_indian', 'vegan', 'salad', false, ARRAY['lunch','dinner']::text[]),
  ('Banana (ripe)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Mango (ripe)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Guava', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Papaya (ripe)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Sweet Lime (Mosambi)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Sapota (Chiku)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Pineapple', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Dates (dry)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Pomegranate', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Watermelon', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Muskmelon (Kharbooja)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Jackfruit (ripe)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Litchi', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Jamun (Java Plum)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Plum', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Peach', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Orange', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Apple', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Amla (Indian Gooseberry)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Custard Apple (Sitaphal)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Strawberry', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Grapes', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Fig (Anjeer)', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Pear', 'pan_indian', 'vegan', 'fruit', true, ARRAY['breakfast','snack']::text[]),
  ('Coconut (fresh grated)', 'pan_indian', 'vegan', 'extras', true, ARRAY['lunch','dinner']::text[]),
  ('Tamarind pulp', 'pan_indian', 'vegan', 'extras', true, ARRAY['lunch','dinner']::text[]),
  ('Lemon', 'pan_indian', 'vegan', 'extras', true, ARRAY['lunch','dinner']::text[]),
  ('Ghee', 'pan_indian', 'veg', 'extras', true, ARRAY['lunch','dinner']::text[]),
  ('Curd / Yogurt', 'pan_indian', 'veg', 'dairy', true, ARRAY['lunch','dinner']::text[]),
  ('Buttermilk (thin)', 'pan_indian', 'veg', 'dairy', true, ARRAY['lunch','dinner']::text[]),
  ('Paneer', 'pan_indian', 'veg', 'dairy', true, ARRAY['lunch','dinner']::text[]),
  ('Medu Vada', 'south_indian', 'vegan', 'snack', false, ARRAY['breakfast','snack']::text[]),
  ('Murukku', 'south_indian', 'veg', 'snack', true, ARRAY['snack']::text[]),
  ('Rava / Semolina Halwa', 'pan_indian', 'veg', 'dessert', true, ARRAY['lunch','dinner','snack']::text[]),
  ('Payasam / Kheer', 'pan_indian', 'veg', 'dessert', true, ARRAY['lunch','dinner','snack']::text[]),
  ('Coconut Chutney', 'south_indian', 'vegan', 'chutney', true, ARRAY['breakfast','dinner']::text[]),
  ('Tomato Chutney', 'south_indian', 'vegan', 'chutney', false, ARRAY['breakfast','dinner']::text[]),
  ('Filter Coffee (with milk)', 'south_indian', 'veg', 'drink', true, ARRAY['breakfast','snack']::text[]),
  ('Masala Chai (with milk)', 'pan_indian', 'veg', 'drink', true, ARRAY['breakfast','snack']::text[]),
  ('Coconut Water', 'pan_indian', 'vegan', 'drink', true, ARRAY['snack']::text[]),
  ('Lassi (sweet)', 'north_indian', 'veg', 'drink', true, ARRAY['lunch','snack']::text[])
) AS v(name, cuisine, diet, dish_type, jain, meals)
WHERE f.name = v.name AND f.kutumbh_id IS NULL;

-- Anything still unclassified in the shared list counts as All-India / Veg
UPDATE public.food_items SET cuisine = 'pan_indian' WHERE cuisine IS NULL AND kutumbh_id IS NULL;
UPDATE public.food_items SET diet = 'veg'           WHERE diet IS NULL    AND kutumbh_id IS NULL;
UPDATE public.food_items SET category = 'extras' WHERE category NOT IN ('staple', 'main', 'dal', 'curry', 'side', 'snack', 'salad', 'fruit', 'dairy', 'drink', 'dessert', 'soup', 'chutney', 'pickle', 'podi', 'extras');

-- 5. Guard the values from now on
ALTER TABLE public.food_items ADD CONSTRAINT food_items_category_check CHECK (category IN ('staple', 'main', 'dal', 'curry', 'side', 'snack', 'salad', 'fruit', 'dairy', 'drink', 'dessert', 'soup', 'chutney', 'pickle', 'podi', 'extras'));
ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_cuisine_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_cuisine_check CHECK (cuisine IS NULL OR cuisine IN ('south_indian', 'north_indian', 'west_indian', 'east_indian', 'northeast_indian', 'pan_indian', 'asian', 'middle_eastern', 'african', 'european', 'latin_american'));
ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_diet_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_diet_check CHECK (diet IS NULL OR diet IN ('vegan', 'veg', 'egg', 'nonveg'));

-- Check: dishes by type (no old names like 'grain' or 'legume' should remain)
SELECT category, count(*) AS dishes FROM public.food_items GROUP BY category ORDER BY category;

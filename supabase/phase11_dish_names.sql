-- ══════════════════════════════════════════════════
-- Phase 11 — One dish, one name
--
-- Two problems, not one:
--
--  1. Five dishes were entered twice, once in English and once in Tamil:
--     Curd Rice / Thayir Sadam, Kheer twice, Puliyodarai twice, Olan twice,
--     and a sprout chaat under two orderings. One of each is kept, along
--     with anything already planned or logged against the other.
--
--  2. About a dozen dishes carried only the Tamil name, so a family
--     searching "coconut rice" found nothing. Those keep their own name
--     and gain the English in brackets, which the search also matches.
--
-- Two look like duplicates but are not: Lentil Soup is both Middle Eastern
-- and French, and Couscous with Seven Vegetables is both Algerian and
-- Moroccan. Those are told apart instead.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- ── 1. Menus and meals move to the dish being kept ──
WITH pairs(keep_recipe, drop_recipe) AS (
  VALUES (290, 506), (304, 553), (106, 505), (334, 518), (428, 467)
), ids AS (
  SELECT fk.id AS keep_id, fd.id AS drop_id
  FROM pairs p
  JOIN public.food_items fk ON fk.recipe_id = p.keep_recipe
  JOIN public.food_items fd ON fd.recipe_id = p.drop_recipe
)
UPDATE public.meal_plans mp
   SET food_item_id = i.keep_id
  FROM ids i
 WHERE mp.food_item_id = i.drop_id;

WITH pairs(keep_recipe, drop_recipe) AS (
  VALUES (290, 506), (304, 553), (106, 505), (334, 518), (428, 467)
), ids AS (
  SELECT fk.id AS keep_id, fd.id AS drop_id
  FROM pairs p
  JOIN public.food_items fk ON fk.recipe_id = p.keep_recipe
  JOIN public.food_items fd ON fd.recipe_id = p.drop_recipe
)
UPDATE public.meal_logs ml
   SET food_item_id = i.keep_id
  FROM ids i
 WHERE ml.food_item_id = i.drop_id;

-- ── 2. The second copy goes ──
DELETE FROM public.food_items WHERE recipe_id IN (506, 553, 505, 518, 467);
DELETE FROM public.recipes    WHERE id        IN (506, 553, 505, 518, 467);

-- ── 3. Names: the family's own word first, the English in brackets ──
WITH names(recipe_id, new_name) AS (VALUES
  (290, 'Curd Rice (Thayir Sadam)'),
  (509, 'Thengai Sadam (Coconut Rice)'),
  (508, 'Elumichai Sadam (Lemon Rice)'),
  (504, 'Sambar Sadam (Sambar Rice)'),
  (507, 'Keerai Kootu (Spinach & Dal Stew)'),
  (404, 'Mor Kuzhambu (Curd Curry)'),
  (510, 'Vatha Kuzhambu (Tamarind Curry)'),
  (517, 'Erissery (Pumpkin & Bean Curry)'),
  (511, 'Paruppu (Tamil Toor Dal)'),
  (515, 'Adai (Mixed Lentil Crepe)'),
  (447, 'Kollu Rasam (Horse Gram Rasam)'),
  (11,  'Paal Payasam (Milk Kheer)'),
  (310, 'Rava Kesari (Semolina Sweet)'),
  (332, 'Bisi Bele Bath (Rice, Dal & Vegetables)'),
  (426, 'Mandakki Oggarane (Puffed Rice Upma)'),
  (61,  'Lentil Soup (French)'),
  (180, 'Couscous with Seven Vegetables (Moroccan)')
)
UPDATE public.recipes r SET name = n.new_name
FROM names n WHERE r.id = n.recipe_id AND r.name <> n.new_name;

-- The dish list follows the recipe, so the menu and the log agree
UPDATE public.food_items f SET name = r.name
FROM public.recipes r
WHERE f.recipe_id = r.id AND f.name <> r.name;

-- Check: nothing planned or logged points at a dish that is gone,
-- and the renamed dishes read as they should
SELECT count(*) AS orphaned_plans FROM public.meal_plans mp
  WHERE mp.food_item_id IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM public.food_items f WHERE f.id = mp.food_item_id);

SELECT r.id, r.name, r.dish_type
FROM public.recipes r
WHERE r.name ILIKE '%(%' AND r.cuisine = 'south_indian'
ORDER BY r.name;

-- ══════════════════════════════════════════════════
-- Sambar and Rasam stand on their own
--
-- They were filed with dal, but in a South Indian meal they are two
-- distinct dishes, each with its own place on the plate. Kootu stays with
-- dal, where it belongs.
-- ══════════════════════════════════════════════════

ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_category_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_category_check
  CHECK (category IN ('staple','main','dal','sambar','rasam','curry','side','snack','salad','fruit',
                      'dairy','drink','dessert','soup','chutney','pickle','podi','extras'));

-- Only dishes already filed as dal move; a rice dish named "Sambar Sadam"
-- or a tiffin named "Idli with Sambar" is left alone.
UPDATE public.recipes SET dish_type = 'sambar'
  WHERE dish_type = 'dal' AND name ~* '(sambar|sambhar)';
UPDATE public.recipes SET dish_type = 'rasam'
  WHERE dish_type = 'dal' AND name ~* '(rasam|saaru|charu)';

UPDATE public.food_items f SET category = r.dish_type
  FROM public.recipes r
 WHERE f.recipe_id = r.id AND f.category <> r.dish_type;

-- A family dish named for what it is follows too
UPDATE public.food_items SET category = 'sambar'
  WHERE category = 'dal' AND name ~* '(sambar|sambhar)';
UPDATE public.food_items SET category = 'rasam'
  WHERE category = 'dal' AND name ~* '(rasam|saaru|charu)';

-- Check: how the three now stand
SELECT category, count(*) AS dishes FROM public.food_items
WHERE category IN ('dal','sambar','rasam') GROUP BY category ORDER BY category;

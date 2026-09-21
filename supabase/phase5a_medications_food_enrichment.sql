-- ══════════════════════════════════════════════════════════════════
-- Phase 5a — Medications + food data enrichment (micronutrients,
-- Rasa / Guna / Vipaka). Run once in Supabase SQL Editor. Safe to re-run.
--
-- Values are per 100 g, approximate, drawn from Indian (IFCT) and USDA
-- food-composition references. Good for trends — not clinical use.
-- Prepared dishes include typical home salt; plain vegetables and
-- fruits carry natural sodium only.
-- ══════════════════════════════════════════════════════════════════


-- ── A. Medications on the health profile ─────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS medications TEXT[] DEFAULT '{}';


-- ── B1. New food columns ─────────────────────────────────────────
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS iron_mg          NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS calcium_mg       NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS vitamin_b12_mcg  NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS vitamin_c_mg     NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS folate_mcg       NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS sodium_mg        NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS potassium_mg     NUMERIC(7,2),
  ADD COLUMN IF NOT EXISTS rasa             TEXT[],   -- six tastes
  ADD COLUMN IF NOT EXISTS guna             TEXT[],   -- qualities
  ADD COLUMN IF NOT EXISTS vipaka           TEXT;     -- post-digestive effect

ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_rasa_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_rasa_check
  CHECK (rasa IS NULL OR rasa <@ ARRAY['sweet','sour','salty','pungent','bitter','astringent']);

ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_guna_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_guna_check
  CHECK (guna IS NULL OR guna <@ ARRAY['heavy','light','oily','dry','smooth','rough','soft','hard','liquid','dense']);

ALTER TABLE public.food_items DROP CONSTRAINT IF EXISTS food_items_vipaka_check;
ALTER TABLE public.food_items ADD CONSTRAINT food_items_vipaka_check
  CHECK (vipaka IS NULL OR vipaka IN ('sweet','sour','pungent'));


-- ── B2. Fill in the shared catalogue (Family Dishes are untouched) ──
UPDATE public.food_items f SET
  iron_mg         = v.fe,
  calcium_mg      = v.ca,
  vitamin_b12_mcg = v.b12,
  vitamin_c_mg    = v.vc,
  folate_mcg      = v.fol,
  sodium_mg       = v.na,
  potassium_mg    = v.k,
  rasa            = v.rasa,
  guna            = v.guna,
  vipaka          = v.vipaka
FROM (VALUES
  --  name                         Fe    Ca    B12  VitC  Folate  Na   K     rasa                                      guna                        vipaka
  -- Grains & staples
  ('White Rice (cooked)',          0.2,  10,   0,   0,    3,     1,   35,  ARRAY['sweet'],                           ARRAY['light','smooth'],    'sweet'),
  ('Brown Rice (cooked)',          0.5,  10,   0,   0,    9,     4,   80,  ARRAY['sweet'],                           ARRAY['heavy','rough'],     'sweet'),
  ('Idli',                         0.6,  15,   0,   0,    15,  250,   60,  ARRAY['sweet','sour'],                    ARRAY['light','soft'],      'sour'),
  ('Dosa (plain)',                 0.9,  20,   0,   0,    15,  300,   90,  ARRAY['sweet','sour'],                    ARRAY['light','oily'],      'sour'),
  ('Uttapam',                      1.0,  25,   0,   4,    18,  300,  120,  ARRAY['sweet','sour'],                    ARRAY['heavy','oily'],      'sour'),
  ('Ven Pongal',                   0.8,  15,   0,   0,    12,  250,   90,  ARRAY['sweet','pungent'],                 ARRAY['heavy','oily'],      'sweet'),
  ('Upma',                         0.9,  15,   0,   2,    10,  300,   80,  ARRAY['sweet','salty'],                   ARRAY['heavy','oily'],      'sweet'),
  ('Chapati / Roti',               1.9,  20,   0,   0,    20,  150,  120,  ARRAY['sweet'],                           ARRAY['heavy','smooth'],    'sweet'),
  ('Poha (cooked)',                2.5,  10,   0,   3,    8,   250,   60,  ARRAY['sweet'],                           ARRAY['light','dry'],       'sweet'),
  ('Wheat Dosa',                   1.4,  20,   0,   0,    15,  250,  110,  ARRAY['sweet'],                           ARRAY['light','oily'],      'sweet'),
  -- Legumes & dals
  ('Toor Dal (cooked)',            1.3,  30,   0,   0,    110, 200,  250,  ARRAY['sweet','astringent'],              ARRAY['light','dry'],       'pungent'),
  ('Moong Dal (cooked)',           1.4,  25,   0,   0,    120, 200,  260,  ARRAY['sweet','astringent'],              ARRAY['light','dry'],       'sweet'),
  ('Chana Dal (cooked)',           2.0,  40,   0,   0,    140, 200,  280,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'pungent'),
  ('Urad Dal (cooked)',            1.5,  40,   0,   0,    90,  200,  220,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Rajma (cooked)',               2.2,  30,   0,   1,    130, 250,  400,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'pungent'),
  ('Chickpeas (cooked)',           2.9,  49,   0,   1,    172, 200,  290,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'pungent'),
  ('Sambar',                       0.8,  25,   0,   4,    30,  350,  180,  ARRAY['sour','pungent'],                  ARRAY['light','liquid'],    'pungent'),
  ('Rasam',                        0.4,  12,   0,   4,    8,   400,  120,  ARRAY['sour','pungent','salty'],          ARRAY['light','liquid'],    'pungent'),
  -- Vegetables
  ('Drumstick / Moringa',          0.4,  30,   0,   141,  44,   42,  461,  ARRAY['pungent','bitter'],                ARRAY['light','dry'],       'pungent'),
  ('Brinjal / Eggplant',           0.3,   9,   0,   2,    22,    2,  229,  ARRAY['sweet','bitter','pungent'],        ARRAY['light','dry'],       'pungent'),
  ('Ash Gourd',                    0.4,  19,   0,   13,   5,   111,    6,  ARRAY['sweet'],                           ARRAY['light','smooth'],    'sweet'),
  ('Ridge Gourd',                  0.4,  20,   0,   12,   7,     3,  139,  ARRAY['sweet'],                           ARRAY['light','dry'],       'sweet'),
  ('Bitter Gourd',                 0.4,  19,   0,   33,   72,    5,  296,  ARRAY['bitter'],                          ARRAY['light','dry'],       'pungent'),
  ('Raw Banana (cooked)',          0.5,   3,   0,   10,   20,    5,  400,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'sweet'),
  ('Yam / Suran (cooked)',         0.5,  14,   0,   12,   16,    8,  670,  ARRAY['pungent','astringent'],            ARRAY['light','dry'],       'pungent'),
  ('Spinach (cooked)',             3.6, 136,   0,   10,   146,  70,  466,  ARRAY['astringent','sweet'],              ARRAY['heavy','dry'],       'pungent'),
  ('Tomato',                       0.7,  11,   0,   23,   13,   11,  218,  ARRAY['sour','sweet'],                    ARRAY['light','liquid'],    'sour'),
  ('Tomato (cooked)',              0.7,  11,   0,   23,   13,   11,  218,  ARRAY['sour','sweet'],                    ARRAY['light','liquid'],    'sour'),
  ('Potato (cooked)',              0.3,   5,   0,   7,    10,    5,  380,  ARRAY['sweet'],                           ARRAY['heavy','dry'],       'sweet'),
  ('Carrot (cooked)',              0.3,  30,   0,   4,    14,   58,  235,  ARRAY['sweet','bitter'],                  ARRAY['light','smooth'],    'sweet'),
  ('Cabbage (cooked)',             0.2,  48,   0,   20,   30,    8,  196,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'pungent'),
  -- Raw vegetables & salad
  ('Tomato (raw)',                 0.3,  10,   0,   14,   15,    5,  237,  ARRAY['sour','sweet'],                    ARRAY['light','liquid'],    'sour'),
  ('Cucumber (raw)',               0.3,  16,   0,   3,    7,     2,  147,  ARRAY['sweet'],                           ARRAY['light','liquid'],    'sweet'),
  ('Onion (raw)',                  0.2,  23,   0,   7,    19,    4,  146,  ARRAY['pungent','sweet'],                 ARRAY['heavy','oily'],      'sweet'),
  ('Carrot (raw)',                 0.3,  33,   0,   6,    19,   69,  320,  ARRAY['sweet','bitter'],                  ARRAY['light','rough'],     'sweet'),
  ('Mixed Green Salad',            0.8,  30,   0,   15,   50,   20,  200,  ARRAY['astringent','bitter'],             ARRAY['light','dry','rough'], 'pungent'),
  ('Sprouts (raw)',                0.9,  13,   0,   13,   61,    6,  149,  ARRAY['sweet','astringent'],              ARRAY['light','dry'],       'sweet'),
  -- Fruits
  ('Banana (ripe)',                0.3,   5,   0,   9,    20,    1,  358,  ARRAY['sweet'],                           ARRAY['heavy','smooth'],    'sour'),
  ('Mango (ripe)',                 0.2,  11,   0,   36,   43,    1,  168,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Coconut (fresh grated)',       2.4,  14,   0,   3,    26,   20,  356,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Guava',                        0.3,  18,   0,   228,  49,    2,  417,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'sweet'),
  ('Papaya (ripe)',                0.3,  20,   0,   61,   37,    8,  182,  ARRAY['sweet'],                           ARRAY['light','smooth'],    'sweet'),
  ('Tamarind pulp',                2.8,  74,   0,   4,    14,   28,  628,  ARRAY['sour','sweet'],                    ARRAY['heavy','dry'],       'sour'),
  ('Lemon',                        0.6,  26,   0,   53,   11,    2,  138,  ARRAY['sour'],                            ARRAY['light','liquid'],    'sour'),
  ('Sweet Lime (Mosambi)',         0.3,  40,   0,   50,   17,    2,  150,  ARRAY['sweet','sour'],                    ARRAY['light','liquid'],    'sweet'),
  ('Sapota (Chiku)',               0.8,  21,   0,   15,   14,   12,  193,  ARRAY['sweet'],                           ARRAY['heavy','smooth'],    'sweet'),
  ('Pineapple',                    0.3,  13,   0,   48,   18,    1,  109,  ARRAY['sour','sweet'],                    ARRAY['heavy','liquid'],    'sour'),
  ('Dates (dry)',                  1.0,  39,   0,   0.4,  19,    2,  656,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Pomegranate',                  0.3,  10,   0,   10,   38,    3,  236,  ARRAY['sweet','sour','astringent'],       ARRAY['light','oily'],      'sweet'),
  ('Watermelon',                   0.2,   7,   0,   8,    3,     1,  112,  ARRAY['sweet'],                           ARRAY['heavy','liquid'],    'sweet'),
  ('Muskmelon (Kharbooja)',        0.2,   9,   0,   37,   21,   16,  267,  ARRAY['sweet'],                           ARRAY['heavy','liquid'],    'sweet'),
  ('Jackfruit (ripe)',             0.2,  24,   0,   14,   24,    2,  448,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Litchi',                       0.3,   5,   0,   72,   14,    1,  171,  ARRAY['sweet','sour'],                    ARRAY['heavy','liquid'],    'sweet'),
  ('Jamun (Java Plum)',            0.2,  19,   0,   14,   3,    14,   79,  ARRAY['astringent','sweet'],              ARRAY['light','dry'],       'pungent'),
  ('Plum',                         0.2,   6,   0,   10,   5,     0,  157,  ARRAY['sour','sweet'],                    ARRAY['heavy','liquid'],    'sour'),
  ('Peach',                        0.3,   6,   0,   7,    4,     0,  190,  ARRAY['sweet','sour'],                    ARRAY['heavy','liquid'],    'sweet'),
  ('Orange',                       0.1,  40,   0,   53,   30,    0,  181,  ARRAY['sweet','sour'],                    ARRAY['heavy','liquid'],    'sweet'),
  ('Apple',                        0.1,   6,   0,   5,    3,     1,  107,  ARRAY['sweet','astringent'],              ARRAY['light','dry'],       'sweet'),
  ('Amla (Indian Gooseberry)',     1.2,  25,   0,   478,  6,     1,  198,  ARRAY['sour','sweet','bitter','pungent','astringent'], ARRAY['light','dry'], 'sweet'),
  ('Custard Apple (Sitaphal)',     0.6,  30,   0,   36,   14,    9,  247,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Strawberry',                   0.4,  16,   0,   59,   24,    1,  153,  ARRAY['sweet','sour'],                    ARRAY['light','liquid'],    'sour'),
  ('Grapes',                       0.4,  10,   0,   3,    2,     2,  191,  ARRAY['sweet'],                           ARRAY['smooth','liquid'],   'sweet'),
  ('Fig (Anjeer)',                 0.4,  35,   0,   2,    6,     1,  232,  ARRAY['sweet'],                           ARRAY['heavy','smooth'],    'sweet'),
  ('Pear',                         0.2,   9,   0,   4,    7,     1,  116,  ARRAY['sweet','astringent'],              ARRAY['heavy','dry'],       'sweet'),
  -- Dairy
  ('Curd / Yogurt',                0.1, 121, 0.4,  0.5,  7,    46,  155,  ARRAY['sour'],                            ARRAY['heavy','oily'],      'sour'),
  ('Buttermilk (thin)',            0.05, 50, 0.2,  0.3,  3,   120,   70,  ARRAY['sour','astringent'],               ARRAY['light','liquid'],    'sweet'),
  ('Ghee',                         0,     4,   0,   0,    0,     2,    5,  ARRAY['sweet'],                           ARRAY['heavy','oily','smooth'], 'sweet'),
  ('Paneer',                       0.2, 300, 0.8,  0,    10,   20,  100,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  -- Snacks & sweets
  ('Medu Vada',                    1.5,  30,   0,   1,    40,  400,  200,  ARRAY['sweet','pungent'],                 ARRAY['heavy','oily'],      'sweet'),
  ('Murukku',                      2.5,  30,   0,   0,    20,  600,  150,  ARRAY['pungent','salty'],                 ARRAY['dry','rough','hard'], 'pungent'),
  ('Rava / Semolina Halwa',        0.8,  30, 0.1,  0,    10,   50,   60,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Payasam / Kheer',              0.3, 110, 0.3,  1,    5,    50,  150,  ARRAY['sweet'],                           ARRAY['heavy','oily'],      'sweet'),
  ('Coconut Chutney',              1.2,  20,   0,   2,    15,  350,  250,  ARRAY['sweet','pungent'],                 ARRAY['heavy','oily'],      'sweet'),
  ('Tomato Chutney',               0.8,  15,   0,   10,   12,  450,  200,  ARRAY['sour','pungent','salty'],          ARRAY['light','oily'],      'sour'),
  -- Beverages
  ('Filter Coffee (with milk)',    0.05, 50, 0.2,  0,    2,    20,  110,  ARRAY['bitter','sweet'],                  ARRAY['light','dry'],       'pungent'),
  ('Masala Chai (with milk)',      0.1,  45, 0.15, 0,    2,    20,   80,  ARRAY['pungent','sweet'],                 ARRAY['light','dry'],       'pungent'),
  ('Coconut Water',                0.3,  24,   0,   2.4,  3,   105,  250,  ARRAY['sweet'],                           ARRAY['light','liquid'],    'sweet'),
  ('Lassi (sweet)',                0.1,  90, 0.3,  0.5,  5,    40,  130,  ARRAY['sweet','sour'],                    ARRAY['heavy','oily'],      'sweet')
) AS v(name, fe, ca, b12, vc, fol, na, k, rasa, guna, vipaka)
WHERE f.name = v.name AND f.kutumbh_id IS NULL;


-- ── B3. Raw vegetables were seeded with only kcal + protein ───────
UPDATE public.food_items f SET
  carbs_g      = COALESCE(f.carbs_g, v.carbs),
  fat_g        = COALESCE(f.fat_g, v.fat),
  fiber_g      = COALESCE(f.fiber_g, v.fiber),
  virya        = COALESCE(f.virya, v.virya),
  vata_effect  = CASE WHEN f.vata_effect  IS NULL OR f.vata_effect  = 'neutral' THEN v.vata  ELSE f.vata_effect  END,
  pitta_effect = CASE WHEN f.pitta_effect IS NULL OR f.pitta_effect = 'neutral' THEN v.pitta ELSE f.pitta_effect END,
  kapha_effect = CASE WHEN f.kapha_effect IS NULL OR f.kapha_effect = 'neutral' THEN v.kapha ELSE f.kapha_effect END
FROM (VALUES
  ('Tomato (raw)',      3.9, 0.2, 1.2, 'heating', 'neutral',    'aggravates', 'balances'),
  ('Cucumber (raw)',    3.6, 0.1, 0.5, 'cooling', 'neutral',    'balances',   'aggravates'),
  ('Onion (raw)',       9.3, 0.1, 1.7, 'heating', 'balances',   'aggravates', 'neutral'),
  ('Carrot (raw)',      9.6, 0.2, 2.8, 'neutral', 'neutral',    'balances',   'balances'),
  ('Mixed Green Salad', 3.5, 0.2, 1.8, 'cooling', 'aggravates', 'balances',   'balances'),
  ('Sprouts (raw)',     6.0, 0.2, 1.8, 'cooling', 'aggravates', 'balances',   'balances')
) AS v(name, carbs, fat, fiber, virya, vata, pitta, kapha)
WHERE f.name = v.name AND f.kutumbh_id IS NULL;


-- ── B4. Catalogue rows added outside the seed files ──────────────
UPDATE public.food_items SET
  iron_mg = 0.3, calcium_mg = 10, vitamin_b12_mcg = 0, vitamin_c_mg = 14,
  folate_mcg = 15, sodium_mg = 5, potassium_mg = 237,
  rasa = ARRAY['sour','sweet'], guna = ARRAY['light','liquid'], vipaka = 'sour',
  carbs_g = COALESCE(carbs_g, 3.9), fat_g = COALESCE(fat_g, 0.2), fiber_g = COALESCE(fiber_g, 1.2),
  virya = COALESCE(virya, 'heating')
WHERE name = 'Tomato (raw, salad)' AND kutumbh_id IS NULL;


-- ── Check: catalogue foods this file didn't recognise ─────────────
-- Any rows returned here were added some other way and still need
-- values (they will show "no micronutrient data" in the app).
SELECT name, category
FROM public.food_items
WHERE kutumbh_id IS NULL AND iron_mg IS NULL
ORDER BY category, name;

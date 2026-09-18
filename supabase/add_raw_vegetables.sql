-- ── Raw vegetables & salad items ─────────────────────────────────
-- Run in Supabase SQL Editor for the my-kutumbh project
-- Calories and protein_g are per 100 g

-- 1. Rename existing cooked tomato so it's unambiguous
UPDATE food_items
SET name = 'Tomato (cooked)'
WHERE name = 'Tomato' AND category = 'vegetable';

-- 2. Insert raw vegetables (only if not already present)
INSERT INTO food_items (name, name_ta, category, calories, protein_g, serving_unit, serving_weight_g, is_south_indian)
SELECT * FROM (VALUES
  ('Tomato (raw)',      'தக்காளி (பச்சை)',   'vegetable', 18,  0.9,  'piece', 100, true),
  ('Cucumber (raw)',    'வெள்ளரிக்காய்',      'vegetable', 16,  0.65, 'piece', 150, true),
  ('Onion (raw)',       'வெங்காயம் (பச்சை)',  'vegetable', 40,  1.1,  'piece', 100, true),
  ('Carrot (raw)',      'கேரட் (பச்சை)',      'vegetable', 41,  0.93, 'piece', 80,  true),
  ('Mixed Green Salad', NULL,                  'vegetable', 20,  1.8,  'bowl',  100, true),
  ('Sprouts (raw)',     'முளைகட்டிய பயறு',    'vegetable', 30,  3.5,  'cup',   100, true)
) AS v(name, name_ta, category, calories, protein_g, serving_unit, serving_weight_g, is_south_indian)
WHERE NOT EXISTS (
  SELECT 1 FROM food_items fi WHERE fi.name = v.name
);

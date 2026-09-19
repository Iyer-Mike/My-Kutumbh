-- ══════════════════════════════════════════════════════════════
-- Seasonal Fruits — Full Indian Fruit Database
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════════════════

-- 1. Add season column (safe to run even if already exists)
ALTER TABLE food_items
  ADD COLUMN IF NOT EXISTS season TEXT DEFAULT 'year-round'
    CHECK (season IN ('year-round', 'summer', 'monsoon', 'winter'));

-- 2. Mark existing fruits with their season
UPDATE food_items SET season = 'year-round'
  WHERE category = 'fruit' AND name IN ('Banana (ripe)', 'Coconut (fresh grated)', 'Papaya (ripe)', 'Guava', 'Tamarind pulp');

UPDATE food_items SET season = 'summer'
  WHERE category = 'fruit' AND name = 'Mango (ripe)';

-- 3. Insert new fruits
--    Columns: name, name_hi, name_ta, category,
--             calories, protein_g, carbs_g, fat_g, fiber_g,
--             virya, vata_effect, pitta_effect, kapha_effect,
--             is_south_indian, season

INSERT INTO food_items
  (name, name_hi, name_ta, category,
   calories, protein_g, carbs_g, fat_g, fiber_g,
   virya, vata_effect, pitta_effect, kapha_effect,
   is_south_indian, season)
VALUES

-- ── YEAR-ROUND ──────────────────────────────────────────────
('Lemon',                 'नींबू',         'எலுமிச்சை',       'fruit',  29, 1.1,  9.3, 0.3, 2.8, 'heating',  'balances',   'aggravates', 'balances',   true,  'year-round'),
('Sweet Lime (Mosambi)',  'मौसंबी',        'சத்துக்குடி',     'fruit',  43, 0.8,  9.3, 0.1, 0.3, 'cooling',  'balances',   'balances',   'balances',   true,  'year-round'),
('Sapota (Chiku)',        'चीकू',          'சப்போட்டா',       'fruit',  83, 0.4, 19.9, 1.1, 5.3, 'cooling',  'balances',   'neutral',    'aggravates', true,  'year-round'),
('Pineapple',             'अनानास',        'அன்னாசி',         'fruit',  50, 0.5, 13.1, 0.1, 1.4, 'heating',  'balances',   'aggravates', 'balances',   true,  'year-round'),
('Dates (dry)',           'खजूर',          'பேரீச்சை',        'fruit', 282, 2.5, 75.0, 0.4, 8.0, 'heating',  'balances',   'aggravates', 'aggravates', true,  'year-round'),
('Pomegranate',           'अनार',          'மாதுளை',          'fruit',  83, 1.7, 18.7, 1.2, 4.0, 'cooling',  'balances',   'balances',   'balances',   true,  'year-round'),

-- ── SUMMER (Mar – Jun) ──────────────────────────────────────
('Watermelon',            'तरबूज',         'தர்பூசணி',        'fruit',  30, 0.6,  7.6, 0.2, 0.4, 'cooling',  'balances',   'balances',   'aggravates', true,  'summer'),
('Muskmelon (Kharbooja)', 'खरबूजा',        'முலாம்பழம்',      'fruit',  34, 0.8,  8.2, 0.2, 0.9, 'cooling',  'balances',   'balances',   'aggravates', true,  'summer'),
('Jackfruit (ripe)',      'कटहल',          'பலாப்பழம்',       'fruit',  95, 1.7, 23.2, 0.6, 1.5, 'heating',  'balances',   'aggravates', 'aggravates', true,  'summer'),
('Litchi',                'लीची',          'லிச்சி',          'fruit',  66, 0.8, 16.5, 0.4, 1.3, 'heating',  'balances',   'aggravates', 'aggravates', true,  'summer'),

-- ── MONSOON (Jul – Sep) ─────────────────────────────────────
('Jamun (Java Plum)',     'जामुन',         'நாவல்பழம்',       'fruit',  60, 0.7, 15.6, 0.2, 0.3, 'cooling',  'balances',   'balances',   'balances',   true,  'monsoon'),
('Plum',                  'आलूबुखारा',     'அரப்பழம்',        'fruit',  46, 0.7, 11.4, 0.3, 1.4, 'cooling',  'balances',   'neutral',    'neutral',    false, 'monsoon'),
('Peach',                 'आड़ू',           'பீச்சம்பழம்',     'fruit',  39, 0.9,  9.5, 0.3, 1.5, 'cooling',  'neutral',    'neutral',    'neutral',    false, 'monsoon'),

-- ── WINTER (Oct – Feb) ──────────────────────────────────────
('Orange',                'संतरा',         'ஆரஞ்சு',          'fruit',  47, 0.9, 11.8, 0.1, 2.4, 'cooling',  'balances',   'aggravates', 'balances',   true,  'winter'),
('Apple',                 'सेब',           'ஆப்பிள்',         'fruit',  52, 0.3, 13.8, 0.2, 2.4, 'cooling',  'balances',   'balances',   'balances',   true,  'winter'),
('Amla (Indian Gooseberry)', 'आंवला',      'நெல்லிக்காய்',    'fruit',  44, 0.9, 10.2, 0.6, 4.3, 'cooling',  'balances',   'balances',   'balances',   true,  'winter'),
('Custard Apple (Sitaphal)', 'शरीफा',      'சீத்தாப்பழம்',    'fruit',  94, 2.1, 22.9, 0.4, 4.4, 'cooling',  'balances',   'aggravates', 'aggravates', true,  'winter'),
('Strawberry',            'स्ट्रॉबेरी',   'ஸ்ட்ராபெரி',      'fruit',  32, 0.7,  7.7, 0.3, 2.0, 'cooling',  'balances',   'neutral',    'neutral',    false, 'winter'),
('Grapes',                'अंगूर',         'திராட்சை',        'fruit',  69, 0.7, 18.1, 0.2, 0.9, 'cooling',  'balances',   'aggravates', 'aggravates', true,  'winter'),
('Fig (Anjeer)',           'अंजीर',         'அத்திப்பழம்',     'fruit',  74, 0.8, 19.2, 0.3, 2.9, 'neutral',  'balances',   'balances',   'neutral',    true,  'winter'),
('Pear',                  'नाशपाती',       'பேரிக்காய்',      'fruit',  57, 0.4, 15.2, 0.1, 3.1, 'cooling',  'balances',   'balances',   'balances',   false, 'winter');

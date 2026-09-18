-- ══════════════════════════════════════════════════
-- Phase 2 — Food Database + Meal Logging
-- Run in Supabase SQL Editor
-- ══════════════════════════════════════════════════

-- ── Food items master ─────────────────────────────
CREATE TABLE IF NOT EXISTS food_items (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  name_hi       TEXT,                        -- Hindi name
  name_ta       TEXT,                        -- Tamil name
  category      TEXT NOT NULL DEFAULT 'other',
                                             -- grain | legume | vegetable | fruit | dairy | snack | sweet | spice | beverage | other

  -- Nutrition per 100 g (cooked / as served)
  calories      NUMERIC(6,1),
  protein_g     NUMERIC(5,2),
  carbs_g       NUMERIC(5,2),
  fat_g         NUMERIC(5,2),
  fiber_g       NUMERIC(5,2),

  -- Ayurvedic
  virya         TEXT CHECK (virya IN ('heating','cooling','neutral')),
  vata_effect   TEXT CHECK (vata_effect   IN ('balances','aggravates','neutral')) DEFAULT 'neutral',
  pitta_effect  TEXT CHECK (pitta_effect  IN ('balances','aggravates','neutral')) DEFAULT 'neutral',
  kapha_effect  TEXT CHECK (kapha_effect  IN ('balances','aggravates','neutral')) DEFAULT 'neutral',

  is_south_indian BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

-- ── Meal intake log ───────────────────────────────
CREATE TABLE IF NOT EXISTS meal_logs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  food_item_id  UUID REFERENCES food_items(id) ON DELETE SET NULL,
  food_name     TEXT NOT NULL,              -- denormalised for resilience
  meal_slot     TEXT NOT NULL CHECK (meal_slot IN ('breakfast','lunch','dinner','other')),
  quantity_g    NUMERIC(6,1) NOT NULL DEFAULT 100,
  calories      NUMERIC(6,1),              -- computed at log time
  protein_g     NUMERIC(5,2),
  carbs_g       NUMERIC(5,2),
  fat_g         NUMERIC(5,2),
  logged_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  logged_at     TIMESTAMPTZ DEFAULT NOW(),
  notes         TEXT
);

-- ── Row Level Security ────────────────────────────
ALTER TABLE food_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_logs  ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read the food catalogue
CREATE POLICY "food_items_select" ON food_items
  FOR SELECT USING (auth.role() = 'authenticated');

-- Each user manages only their own logs
CREATE POLICY "meal_logs_select" ON meal_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "meal_logs_insert" ON meal_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "meal_logs_update" ON meal_logs
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "meal_logs_delete" ON meal_logs
  FOR DELETE USING (user_id = auth.uid());

-- ── Seed: 50 core South Indian food items ─────────
INSERT INTO food_items
  (name, name_hi, name_ta, category, calories, protein_g, carbs_g, fat_g, fiber_g, virya, vata_effect, pitta_effect, kapha_effect, is_south_indian)
VALUES

-- GRAINS & STAPLES
('White Rice (cooked)',     'सफेद चावल',   'வெள்ளை அரிசி',   'grain',     130, 2.7, 28.2, 0.3, 0.4,  'cooling',  'balances',   'balances',   'aggravates', true),
('Brown Rice (cooked)',     'ब्राउन चावल',  'பழுப்பு அரிசி',  'grain',     123, 2.6, 25.6, 1.0, 1.8,  'neutral',  'balances',   'balances',   'balances',   true),
('Idli',                   'इडली',         'இட்லி',           'grain',     130, 3.5, 24.0, 0.5, 1.0,  'cooling',  'balances',   'balances',   'aggravates', true),
('Dosa (plain)',            'डोसा',         'தோசை',           'grain',     168, 4.0, 30.0, 4.0, 1.0,  'neutral',  'balances',   'aggravates', 'balances',   true),
('Uttapam',                'उत्तपम',        'உத்தப்பம்',       'grain',     145, 4.5, 25.0, 3.5, 1.5,  'neutral',  'balances',   'neutral',    'balances',   true),
('Ven Pongal',             'पोंगल',         'வெண் பொங்கல்',  'grain',     160, 4.5, 26.0, 5.0, 1.0,  'neutral',  'balances',   'balances',   'aggravates', true),
('Upma',                   'उपमा',         'உப்புமா',         'grain',     140, 3.5, 22.0, 5.0, 1.5,  'neutral',  'balances',   'neutral',    'balances',   true),
('Chapati / Roti',         'चपाती',        'சப்பாத்தி',       'grain',     120, 3.5, 21.5, 2.5, 1.8,  'neutral',  'balances',   'balances',   'balances',   false),
('Poha (cooked)',          'पोहा',         'அவல்',            'grain',     132, 2.5, 26.5, 2.0, 0.8,  'neutral',  'balances',   'balances',   'aggravates', true),
('Wheat Dosa',             'गेहूं का डोसा','கோதுமை தோசை',    'grain',     150, 4.5, 28.0, 3.0, 2.0,  'neutral',  'balances',   'balances',   'balances',   true),

-- LEGUMES & DALS
('Toor Dal (cooked)',       'अरहर दाल',    'துவரம் பருப்பு',  'legume',    116, 7.0, 19.5, 0.4, 3.7,  'neutral',  'aggravates', 'neutral',    'balances',   true),
('Moong Dal (cooked)',      'मूंग दाल',    'பச்சை பருப்பு',   'legume',     99, 7.0, 17.0, 0.4, 4.0,  'cooling',  'balances',   'balances',   'balances',   true),
('Chana Dal (cooked)',      'चना दाल',     'கடலை பருப்பு',    'legume',    127, 8.0, 22.0, 2.0, 4.5,  'neutral',  'aggravates', 'balances',   'balances',   true),
('Urad Dal (cooked)',       'उड़द दाल',    'உளுந்து பருப்பு', 'legume',    105, 7.5, 18.5, 0.5, 2.5,  'heating',  'balances',   'aggravates', 'balances',   true),
('Rajma (cooked)',          'राजमा',       'ராஜ்மா',          'legume',    127, 8.7, 22.8, 0.5, 6.4,  'neutral',  'aggravates', 'neutral',    'balances',   false),
('Chickpeas (cooked)',      'काबुली चना',  'கொண்டைக்கடலை',   'legume',    164, 8.9, 27.4, 2.6, 7.6,  'neutral',  'aggravates', 'neutral',    'balances',   false),
('Sambar',                 'सांभर',        'சாம்பார்',        'legume',     54, 2.8,  7.5, 1.5, 2.0,  'heating',  'balances',   'neutral',    'balances',   true),
('Rasam',                  'रसम',          'ரசம்',            'legume',     28, 1.0,  4.5, 0.8, 0.5,  'heating',  'balances',   'aggravates', 'balances',   true),

-- VEGETABLES
('Drumstick / Moringa',    'सहजन',        'முருங்கை',        'vegetable',  37, 2.5,  6.0, 0.4, 3.2,  'neutral',  'balances',   'balances',   'balances',   true),
('Brinjal / Eggplant',     'बैंगन',        'கத்திரிக்காய்',   'vegetable',  25, 1.0,  5.5, 0.2, 3.0,  'heating',  'aggravates', 'aggravates', 'balances',   true),
('Ash Gourd',              'पेठा',         'வெண்பூசணி',      'vegetable',  13, 0.4,  3.0, 0.1, 0.8,  'cooling',  'balances',   'balances',   'neutral',    true),
('Ridge Gourd',            'तोरई',         'பீர்க்கன்',       'vegetable',  17, 0.6,  3.7, 0.1, 0.5,  'cooling',  'balances',   'balances',   'balances',   true),
('Bitter Gourd',           'करेला',        'பாகற்காய்',       'vegetable',  17, 1.0,  3.5, 0.2, 2.8,  'cooling',  'neutral',    'balances',   'balances',   true),
('Raw Banana (cooked)',    'कच्चा केला',   'வாழைக்காய்',     'vegetable',  89, 1.3, 22.0, 0.3, 2.6,  'neutral',  'balances',   'balances',   'aggravates', true),
('Yam / Suran (cooked)',   'सूरन',         'காரட்',           'vegetable', 118, 1.5, 27.0, 0.1, 4.2,  'neutral',  'balances',   'neutral',    'neutral',    true),
('Spinach (cooked)',       'पालक',         'கீரை',            'vegetable',  23, 2.5,  3.0, 0.5, 2.4,  'cooling',  'balances',   'balances',   'balances',   true),
('Tomato',                 'टमाटर',        'தக்காளி',         'vegetable',  18, 0.9,  3.9, 0.2, 1.2,  'heating',  'neutral',    'aggravates', 'balances',   true),
('Potato (cooked)',        'आलू',          'உருளைக்கிழங்கு',  'vegetable',  86, 1.9, 19.5, 0.1, 1.8,  'neutral',  'aggravates', 'neutral',    'aggravates', true),
('Carrot (cooked)',        'गाजर',         'கேரட்',           'vegetable',  35, 0.8,  8.2, 0.2, 2.9,  'neutral',  'balances',   'balances',   'balances',   true),
('Cabbage (cooked)',       'पत्तागोभी',    'முட்டைகோஸ்',      'vegetable',  25, 1.3,  5.4, 0.1, 2.3,  'neutral',  'aggravates', 'balances',   'balances',   true),

-- FRUITS
('Banana (ripe)',           'केला',         'வாழைப்பழம்',     'fruit',      89, 1.1, 22.8, 0.3, 2.6,  'cooling',  'balances',   'balances',   'aggravates', true),
('Mango (ripe)',            'आम',           'மாம்பழம்',       'fruit',      60, 0.8, 15.0, 0.4, 1.6,  'heating',  'balances',   'aggravates', 'aggravates', true),
('Coconut (fresh grated)', 'नारियल',       'தேங்காய்',        'fruit',     354, 3.3, 15.2,33.5, 9.0,  'cooling',  'balances',   'balances',   'aggravates', true),
('Guava',                  'अमरूद',        'கொய்யா',          'fruit',      68, 2.6, 14.3, 1.0, 5.4,  'cooling',  'balances',   'balances',   'balances',   true),
('Papaya (ripe)',           'पपीता',        'பப்பாளி',         'fruit',      43, 0.5, 11.0, 0.3, 1.7,  'neutral',  'balances',   'balances',   'balances',   true),
('Tamarind pulp',          'इमली',         'புளி',            'fruit',     239, 2.8, 62.5, 0.6, 5.1,  'heating',  'aggravates', 'aggravates', 'balances',   true),

-- DAIRY
('Curd / Yogurt',          'दही',          'தயிர்',           'dairy',      61, 3.5,  4.7, 3.3, 0.0,  'cooling',  'balances',   'aggravates', 'aggravates', true),
('Buttermilk (thin)',      'छाछ',          'மோர்',            'dairy',      15, 1.0,  1.7, 0.5, 0.0,  'cooling',  'balances',   'balances',   'balances',   true),
('Ghee',                   'घी',           'நெய்',            'dairy',     900, 0.0,  0.0,99.7, 0.0,  'neutral',  'balances',   'neutral',    'aggravates', true),
('Paneer',                 'पनीर',         'பனீர்',           'dairy',     265,18.3,  1.2,21.0, 0.0,  'cooling',  'balances',   'neutral',    'aggravates', false),

-- SNACKS & SWEETS
('Medu Vada',              'मेदु वड़ा',    'மேது வடை',        'snack',     260, 7.0, 26.5,13.5, 2.5,  'heating',  'neutral',    'aggravates', 'aggravates', true),
('Murukku',                'मुरुक्कू',     'முறுக்கு',        'snack',     465, 6.5, 63.0,21.0, 2.0,  'heating',  'aggravates', 'aggravates', 'aggravates', true),
('Rava / Semolina Halwa',  'सूजी का हलवा', 'ரவா அல்வா',      'sweet',     220, 3.0, 35.0, 8.0, 1.0,  'heating',  'neutral',    'aggravates', 'aggravates', true),
('Payasam / Kheer',        'खीर',          'பாயசம்',          'sweet',     180, 4.5, 28.0, 6.0, 0.3,  'cooling',  'balances',   'aggravates', 'aggravates', true),
('Coconut Chutney',        'नारियल चटनी',  'தேங்காய் சட்னி',  'spice',     180, 2.0,  8.0,16.0, 4.0,  'cooling',  'balances',   'balances',   'aggravates', true),
('Tomato Chutney',         'टमाटर चटनी',  'தக்காளி சட்னி',   'spice',      55, 1.5,  7.5, 2.5, 1.5,  'heating',  'neutral',    'aggravates', 'balances',   true),

-- BEVERAGES
('Filter Coffee (with milk)','फिल्टर कॉफी', 'ஃபில்டர் காபி',  'beverage',   40, 1.5,  5.5, 1.5, 0.0,  'heating',  'aggravates', 'aggravates', 'balances',   true),
('Masala Chai (with milk)', 'मसाला चाय',   'மசாலா டீ',       'beverage',   35, 1.5,  5.0, 1.0, 0.0,  'heating',  'aggravates', 'aggravates', 'balances',   false),
('Coconut Water',           'नारियल पानी', 'இளநீர்',          'beverage',   19, 0.7,  3.7, 0.2, 1.1,  'cooling',  'balances',   'balances',   'neutral',    true),
('Lassi (sweet)',           'मीठी लस्सी',  'லஸ்ஸி',           'beverage',   80, 2.5, 11.0, 2.5, 0.0,  'cooling',  'balances',   'aggravates', 'aggravates', true);

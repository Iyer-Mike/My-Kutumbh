-- Made at home: curd, sambar powder, garam masala, pickles, ghee from butter.
-- Such an item is never "bought": when it runs low it goes on a "to make" list instead of the shopping list.
-- Safe to run more than once.

ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS made_at_home boolean NOT NULL DEFAULT false;

-- Check: should show one row
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'pantry_items' AND column_name = 'made_at_home';

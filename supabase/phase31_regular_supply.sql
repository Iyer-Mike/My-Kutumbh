-- Regular supply: things that come to the door on their own (milk, curd, eggs, the water can).
-- They are not counted down or put on the shopping list; the shelf simply says how often and how much.
-- Safe to run more than once.

ALTER TABLE public.pantry_items
  ADD COLUMN IF NOT EXISTS supply_qty   numeric,
  ADD COLUMN IF NOT EXISTS supply_every smallint;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'pantry_supply_every_range') THEN
    ALTER TABLE public.pantry_items
      ADD CONSTRAINT pantry_supply_every_range CHECK (supply_every IS NULL OR supply_every BETWEEN 1 AND 31);
  END IF;
END $$;

-- Check: should show both columns
SELECT column_name FROM information_schema.columns
 WHERE table_schema = 'public' AND table_name = 'pantry_items' AND column_name IN ('supply_qty', 'supply_every')
 ORDER BY column_name;

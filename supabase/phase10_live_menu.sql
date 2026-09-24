-- ══════════════════════════════════════════════════
-- Phase 10 — The menu appears on everyone's phone at once
--
-- When one member adds a dish to today's menu, the others only saw it
-- after a reload. These tables now tell the app when they change, so a
-- menu put up in the kitchen shows on every phone in the family.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- Supabase listens to this publication and forwards the changes
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_plans'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_plans;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'meal_pools'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.meal_pools;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'shopping_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.shopping_items;
  END IF;
END $$;

-- A change is only forwarded to someone allowed to read the row, so the
-- family's rules still decide who hears about what.

-- Check: the three tables should be listed
SELECT tablename FROM pg_publication_tables
WHERE pubname = 'supabase_realtime' AND schemaname = 'public'
ORDER BY tablename;

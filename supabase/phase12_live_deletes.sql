-- ══════════════════════════════════════════════════
-- Phase 12 — A dish taken off the menu disappears everywhere too
--
-- Adding a dish already reached the other phones. Removing one did not.
--
-- Why: when a row is deleted, Postgres only tells the listener which row
-- it was — the id, nothing else. The app listens for "changes to my
-- family's rows", and with only an id to go on, the change could not be
-- matched to a family, so it was dropped in silence.
--
-- REPLICA IDENTITY FULL makes Postgres hand over the whole row as it was
-- before the delete, so the family it belonged to is known.
--
-- pantry_items also joins the list — the shelf was listening for it, but
-- nothing was being sent.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

ALTER TABLE public.meal_plans     REPLICA IDENTITY FULL;
ALTER TABLE public.meal_pools     REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.pantry_items   REPLICA IDENTITY FULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'pantry_items'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.pantry_items;
  END IF;
END $$;

-- Check: all four should read "f" (full) and be in the publication
SELECT c.relname AS table_name,
       c.relreplident = 'f' AS sends_whole_row,
       EXISTS (SELECT 1 FROM pg_publication_tables pt
                WHERE pt.pubname = 'supabase_realtime'
                  AND pt.schemaname = 'public' AND pt.tablename = c.relname) AS is_live
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
  AND c.relname IN ('meal_plans','meal_pools','shopping_items','pantry_items')
ORDER BY c.relname;

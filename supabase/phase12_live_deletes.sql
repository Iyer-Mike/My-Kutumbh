-- ══════════════════════════════════════════════════
-- Phase 12 — A dish taken off the menu disappears everywhere too
--
-- Two things were missing.
--
--  1. When a row is deleted, Postgres only tells the listener which row
--     it was — the id, nothing else. The app listens for "changes to my
--     family's rows", and with only an id to go on, the change could not
--     be matched to a family, so it was dropped in silence.
--     REPLICA IDENTITY FULL hands over the whole row as it was before
--     the delete, so the family it belonged to is known.
--
--  2. A table only speaks up if it has been asked to. This makes sure all
--     four have been, pantry_items included — the shelf was listening for
--     it, but nothing was being sent.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

ALTER TABLE public.meal_plans     REPLICA IDENTITY FULL;
ALTER TABLE public.meal_pools     REPLICA IDENTITY FULL;
ALTER TABLE public.shopping_items REPLICA IDENTITY FULL;
ALTER TABLE public.pantry_items   REPLICA IDENTITY FULL;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['meal_plans','meal_pools','shopping_items','pantry_items'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
    END IF;
  END LOOP;
END $$;

-- A change is only passed on to someone allowed to read the row, so the
-- family's own rules still decide who hears about what.

-- Check: all four should say true, true
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

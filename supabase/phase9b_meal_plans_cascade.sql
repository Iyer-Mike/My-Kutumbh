-- ══════════════════════════════════════════════════
-- Phase 9b — A deleted Kutumbh takes its menus with it
--
-- meal_plans.kutumbh_id was added later than the rest and never got the
-- "on delete cascade" every other table has, so deleting a family was
-- refused:
--   update or delete on table "kutumbhs" violates foreign key constraint
--   "meal_plans_kutumbh_id_fkey" on table "meal_plans"
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

ALTER TABLE public.meal_plans DROP CONSTRAINT IF EXISTS meal_plans_kutumbh_id_fkey;

ALTER TABLE public.meal_plans
  ADD CONSTRAINT meal_plans_kutumbh_id_fkey
  FOREIGN KEY (kutumbh_id) REFERENCES public.kutumbhs(id) ON DELETE CASCADE;

-- Check: every table that points at a Kutumbh, and what it does when one goes.
-- All should read CASCADE.
SELECT
  tc.table_name,
  tc.constraint_name,
  rc.delete_rule
FROM information_schema.table_constraints tc
JOIN information_schema.referential_constraints rc ON rc.constraint_name = tc.constraint_name
JOIN information_schema.constraint_column_usage ccu ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND ccu.table_name = 'kutumbhs'
  AND ccu.column_name = 'id'
ORDER BY tc.table_name;

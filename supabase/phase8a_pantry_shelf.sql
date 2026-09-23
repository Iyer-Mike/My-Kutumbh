-- ══════════════════════════════════════════════════
-- Phase 8a — Pantry Shelf
--   What the kitchen holds, and what needs buying.
--   Three kinds of stock, because they behave differently:
--     staple : rice, dal, atta, oil  → real quantities + a "low when" line
--     fresh  : vegetables, milk, curd → bought-on date, used within days
--     sundry : spices, papad, hing    → just ok / low / out
--   The Prime Member keeps the shelf; any member can flag "running low".
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- 1. The shelf itself
CREATE TABLE IF NOT EXISTS public.pantry_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id      UUID NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  kind            TEXT NOT NULL DEFAULT 'staple' CHECK (kind IN ('staple', 'fresh', 'sundry')),
  category        TEXT NOT NULL DEFAULT 'other'
                    CHECK (category IN ('grain', 'dal', 'flour', 'oil', 'spice', 'vegetable',
                                        'fruit', 'dairy', 'dry_fruit', 'ready', 'other')),
  -- staples and fresh items carry an amount; sundries do not
  quantity        NUMERIC(10,2),
  unit            TEXT CHECK (unit IN ('kg', 'g', 'l', 'ml', 'packet', 'piece', 'bunch', 'dozen')),
  low_when        NUMERIC(10,2),                      -- staples: buy more below this
  status          TEXT NOT NULL DEFAULT 'ok' CHECK (status IN ('ok', 'low', 'out')),
  bought_on       DATE,                               -- fresh items
  use_within_days INTEGER,                            -- fresh items: shelf life in days
  note            TEXT,
  food_item_id    UUID REFERENCES public.food_items(id) ON DELETE SET NULL,
  updated_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS pantry_items_unique_name
  ON public.pantry_items (kutumbh_id, lower(name));
CREATE INDEX IF NOT EXISTS pantry_items_kutumbh_idx ON public.pantry_items (kutumbh_id, kind);

-- 2. The shopping list
CREATE TABLE IF NOT EXISTS public.shopping_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id      UUID NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  quantity        NUMERIC(10,2),
  unit            TEXT CHECK (unit IN ('kg', 'g', 'l', 'ml', 'packet', 'piece', 'bunch', 'dozen')),
  source          TEXT NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'low', 'menu')),
  status          TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'bought')),
  pantry_item_id  UUID REFERENCES public.pantry_items(id) ON DELETE SET NULL,
  requested_by    UUID REFERENCES auth.users(id),
  bought_by       UUID REFERENCES auth.users(id),
  bought_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS shopping_items_kutumbh_idx ON public.shopping_items (kutumbh_id, status);

-- 3. Who may see and change what
ALTER TABLE public.pantry_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shopping_items ENABLE ROW LEVEL SECURITY;

-- The shelf is the family's to see
DROP POLICY IF EXISTS "pantry_select" ON public.pantry_items;
CREATE POLICY "pantry_select" ON public.pantry_items
  FOR SELECT USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));

-- The Prime Member keeps it
DROP POLICY IF EXISTS "pantry_insert" ON public.pantry_items;
CREATE POLICY "pantry_insert" ON public.pantry_items
  FOR INSERT WITH CHECK (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));

DROP POLICY IF EXISTS "pantry_update" ON public.pantry_items;
CREATE POLICY "pantry_update" ON public.pantry_items
  FOR UPDATE USING (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));

DROP POLICY IF EXISTS "pantry_delete" ON public.pantry_items;
CREATE POLICY "pantry_delete" ON public.pantry_items
  FOR DELETE USING (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));

-- Anyone in the family may write on the shopping list
DROP POLICY IF EXISTS "shopping_select" ON public.shopping_items;
CREATE POLICY "shopping_select" ON public.shopping_items
  FOR SELECT USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));

DROP POLICY IF EXISTS "shopping_insert" ON public.shopping_items;
CREATE POLICY "shopping_insert" ON public.shopping_items
  FOR INSERT WITH CHECK (
    kutumbh_id IN (SELECT public.my_kutumbh_ids()) AND requested_by = auth.uid()
  );

DROP POLICY IF EXISTS "shopping_update" ON public.shopping_items;
CREATE POLICY "shopping_update" ON public.shopping_items
  FOR UPDATE USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_kutumbh_ids()));

-- Your own request, or anything at all if you are the Prime Member
DROP POLICY IF EXISTS "shopping_delete" ON public.shopping_items;
CREATE POLICY "shopping_delete" ON public.shopping_items
  FOR DELETE USING (
    kutumbh_id IN (SELECT public.my_prime_kutumbh_ids())
    OR (kutumbh_id IN (SELECT public.my_kutumbh_ids()) AND requested_by = auth.uid())
  );

-- 4. A member flagging "running low" is not an edit of the shelf, so it goes
--    through a function that adds the request to the shopping list instead.
CREATE OR REPLACE FUNCTION public.flag_pantry_low(p_item UUID)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_item  public.pantry_items%ROWTYPE;
  v_id    UUID;
BEGIN
  SELECT * INTO v_item FROM public.pantry_items WHERE id = p_item;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'That item is not on the shelf';
  END IF;
  IF v_item.kutumbh_id NOT IN (SELECT public.my_kutumbh_ids()) THEN
    RAISE EXCEPTION 'That shelf belongs to another Kutumbh';
  END IF;

  UPDATE public.pantry_items
     SET status = 'low', updated_by = auth.uid(), updated_at = NOW()
   WHERE id = p_item AND status <> 'out';

  -- One open request per item is enough
  SELECT id INTO v_id FROM public.shopping_items
   WHERE pantry_item_id = p_item AND status = 'open'
   LIMIT 1;

  IF v_id IS NULL THEN
    INSERT INTO public.shopping_items (kutumbh_id, name, unit, source, pantry_item_id, requested_by)
    VALUES (v_item.kutumbh_id, v_item.name, v_item.unit, 'low', p_item, auth.uid())
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.flag_pantry_low(UUID) TO authenticated;

-- Check: the two tables and their policies
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('pantry_items', 'shopping_items')
ORDER BY tablename, policyname;

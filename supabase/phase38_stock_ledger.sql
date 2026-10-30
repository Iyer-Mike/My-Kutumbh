-- Pantry stock, made explainable.
--  * Every change to a shelf figure (count, purchase, batch made) is written down, with before and after.
--  * A physical count and a purchase can no longer be added together by mistake:
--    if you counted on or after the day you bought, the app asks whether the count already includes it.
--  * The phone's estimate can no longer raise stock above what was on the shelf.
--  * The household's daily use is learned from real counts only.
-- Safe to run more than once. Old record_purchase/set_stock stay for phones still running the old page.

CREATE TABLE IF NOT EXISTS public.pantry_stock_events (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id      uuid NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  pantry_item_id  uuid NOT NULL REFERENCES public.pantry_items(id) ON DELETE CASCADE,
  kind            text NOT NULL CHECK (kind IN ('count', 'purchase', 'made', 'adjust')),
  qty             numeric,            -- the amount counted / bought / made
  before_qty      numeric,
  after_qty       numeric,
  added           boolean NOT NULL DEFAULT true,   -- false: noted, but already inside a count
  on_date         date NOT NULL DEFAULT current_date,
  note            text,
  created_by      uuid DEFAULT auth.uid(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS pantry_stock_events_item ON public.pantry_stock_events (pantry_item_id, created_at DESC);

ALTER TABLE public.pantry_stock_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "stock_events_select" ON public.pantry_stock_events;
CREATE POLICY "stock_events_select" ON public.pantry_stock_events
  FOR SELECT TO authenticated USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));
-- No insert/update/delete policies: events are written only by the functions below.

-- ── A physical count: "I looked, there is this much" ─────────────────────
CREATE OR REPLACE FUNCTION public.count_stock(p_item uuid, p_qty numeric, p_on date DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.pantry_items%ROWTYPE;
  prev public.pantry_stock_events%ROWTYPE;
  bought numeric; days int; consumed numeric; obs numeric; d date := coalesce(p_on, current_date);
BEGIN
  SELECT * INTO v FROM public.pantry_items WHERE id = p_item;
  IF NOT FOUND OR v.kutumbh_id NOT IN (SELECT public.my_kutumbh_ids()) THEN RAISE EXCEPTION 'That item is not on your shelf'; END IF;
  IF p_qty IS NULL OR p_qty < 0 THEN RAISE EXCEPTION 'Please give an amount of zero or more'; END IF;

  -- Learn the household's daily use from two real counts
  SELECT * INTO prev FROM public.pantry_stock_events
   WHERE pantry_item_id = p_item AND kind = 'count' ORDER BY created_at DESC LIMIT 1;
  IF FOUND AND prev.after_qty IS NOT NULL THEN
    days := d - prev.on_date;
    IF days >= 3 THEN
      SELECT coalesce(sum(qty), 0) INTO bought FROM public.pantry_stock_events
       WHERE pantry_item_id = p_item AND kind IN ('purchase', 'made') AND added AND created_at > prev.created_at;
      consumed := prev.after_qty + bought - p_qty;
      IF consumed > 0 THEN
        obs := consumed / days;
        UPDATE public.pantry_items SET daily_use =
          CASE WHEN daily_use IS NULL THEN round(obs, 4) ELSE round(0.6 * daily_use + 0.4 * obs, 4) END
         WHERE id = p_item;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.pantry_stock_events (kutumbh_id, pantry_item_id, kind, qty, before_qty, after_qty, on_date)
  VALUES (v.kutumbh_id, p_item, 'count', p_qty, v.quantity, p_qty, d);

  UPDATE public.pantry_items
     SET quantity = p_qty, stock_at = now(),
         status = CASE WHEN p_qty <= 0 THEN 'out' ELSE 'ok' END,
         updated_by = auth.uid(), updated_at = now()
   WHERE id = p_item;
END $$;
REVOKE ALL ON FUNCTION public.count_stock(uuid, numeric, date) FROM public;
GRANT EXECUTE ON FUNCTION public.count_stock(uuid, numeric, date) TO authenticated;

-- The older entry point now counts too, so "Have plenty / About half / Ran out" leave a trail
CREATE OR REPLACE FUNCTION public.set_stock(p_item uuid, p_qty numeric)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
  PERFORM public.count_stock(p_item, greatest(p_qty, 0), current_date);
END $$;

-- ── A purchase or a batch made ───────────────────────────────────────────
-- p_included: NULL = not asked yet, TRUE = a count already includes it, FALSE = add it.
CREATE OR REPLACE FUNCTION public.record_purchase_v2(
  p_item uuid, p_qty numeric, p_unit text, p_on date, p_shop text,
  p_est numeric DEFAULT NULL, p_included boolean DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v public.pantry_items%ROWTYPE; c public.pantry_stock_events%ROWTYPE;
  d date := coalesce(p_on, current_date); base numeric; after numeric; adds boolean; k text;
BEGIN
  SELECT * INTO v FROM public.pantry_items WHERE id = p_item;
  IF NOT FOUND THEN RAISE EXCEPTION 'That item is not on the shelf'; END IF;
  IF v.kutumbh_id NOT IN (SELECT public.my_kutumbh_ids()) THEN RAISE EXCEPTION 'That shelf belongs to another Kutumbh'; END IF;
  IF p_qty IS NOT NULL AND p_qty < 0 THEN RAISE EXCEPTION 'An amount cannot be negative'; END IF;

  -- The same purchase tapped twice in a few seconds is one purchase
  IF EXISTS (SELECT 1 FROM public.pantry_stock_events e
              WHERE e.pantry_item_id = p_item AND e.kind IN ('purchase','made') AND e.qty IS NOT DISTINCT FROM p_qty
                AND e.created_by IS NOT DISTINCT FROM auth.uid() AND e.created_at > now() - interval '20 seconds') THEN
    RETURN jsonb_build_object('status', 'ok', 'duplicate', true);
  END IF;

  -- Counted on or after the day it was bought? Then the count may already include it: ask
  IF p_qty IS NOT NULL AND p_qty > 0 AND p_included IS NULL THEN
    SELECT * INTO c FROM public.pantry_stock_events
     WHERE pantry_item_id = p_item AND kind = 'count' ORDER BY created_at DESC LIMIT 1;
    IF FOUND AND c.on_date >= d THEN
      RETURN jsonb_build_object('status', 'ask', 'counted', c.after_qty, 'counted_on', c.on_date);
    END IF;
  END IF;

  adds := coalesce(p_included, false) = false;
  k := CASE WHEN nullif(btrim(coalesce(p_shop, '')), '') = 'Made at home' THEN 'made' ELSE 'purchase' END;

  -- What was on the shelf: the phone's estimate, but never more than the shelf last held
  base := greatest(coalesce(p_est, v.quantity, 0), 0);
  IF v.quantity IS NOT NULL THEN base := least(base, v.quantity); END IF;
  after := CASE WHEN p_qty IS NULL THEN coalesce(p_est, v.quantity)
                WHEN adds THEN round(base + p_qty, 3)
                ELSE v.quantity END;

  INSERT INTO public.pantry_purchases (kutumbh_id, pantry_item_id, quantity, unit, bought_on, shop, created_by)
  VALUES (v.kutumbh_id, p_item, p_qty, coalesce(p_unit, v.unit), d, nullif(btrim(coalesce(p_shop, '')), ''), auth.uid());

  INSERT INTO public.pantry_stock_events (kutumbh_id, pantry_item_id, kind, qty, before_qty, after_qty, added, on_date)
  VALUES (v.kutumbh_id, p_item, k, p_qty, v.quantity, after, adds, d);

  UPDATE public.pantry_items
     SET quantity = after, stock_at = CASE WHEN adds OR p_qty IS NULL THEN now() ELSE stock_at END,
         status = 'ok', bought_on = d, updated_by = auth.uid(), updated_at = now()
   WHERE id = p_item;

  UPDATE public.shopping_items
     SET status = 'bought', bought_by = auth.uid(), bought_at = now()
   WHERE pantry_item_id = p_item AND status = 'open';

  RETURN jsonb_build_object('status', 'ok', 'after', after);
END $$;
REVOKE ALL ON FUNCTION public.record_purchase_v2(uuid, numeric, text, date, text, numeric, boolean) FROM public;
GRANT EXECUTE ON FUNCTION public.record_purchase_v2(uuid, numeric, text, date, text, numeric, boolean) TO authenticated;

-- Check: the table and the three functions should all be listed
SELECT 'table' AS what, count(*)::text AS found FROM information_schema.tables
 WHERE table_schema = 'public' AND table_name = 'pantry_stock_events'
UNION ALL
SELECT 'functions', count(*)::text FROM pg_proc
 WHERE pronamespace = 'public'::regnamespace AND proname IN ('count_stock', 'set_stock', 'record_purchase_v2');

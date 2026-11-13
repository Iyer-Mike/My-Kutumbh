-- Bills as spending records. Each bill the Key Member photographs, once checked and
-- approved, is kept as a dated bill with its lines and prices, so the family's food
-- spending can be added up by month. The photo itself is never stored.
-- Visible to and written by the Key Member only. Safe to run more than once.

CREATE TABLE IF NOT EXISTS public.bills (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id  uuid NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  bill_date   date NOT NULL,
  shop        text,
  total       numeric CHECK (total IS NULL OR total >= 0),   -- as printed on the bill, if read
  created_by  uuid DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bills_kutumbh_date ON public.bills (kutumbh_id, bill_date DESC);

CREATE TABLE IF NOT EXISTS public.bill_lines (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id     uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  kutumbh_id  uuid NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  name        text NOT NULL,
  quantity    numeric,
  unit        text,
  category    text NOT NULL DEFAULT 'other',
  price       numeric CHECK (price IS NULL OR price >= 0),   -- what was paid for this line
  is_food     boolean NOT NULL DEFAULT true
);
CREATE INDEX IF NOT EXISTS bill_lines_bill ON public.bill_lines (bill_id);

ALTER TABLE public.bills ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS bills_prime ON public.bills;
CREATE POLICY bills_prime ON public.bills FOR ALL TO authenticated
  USING (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));

DROP POLICY IF EXISTS bill_lines_prime ON public.bill_lines;
CREATE POLICY bill_lines_prime ON public.bill_lines FOR ALL TO authenticated
  USING (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()))
  WITH CHECK (kutumbh_id IN (SELECT public.my_prime_kutumbh_ids()));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bills, public.bill_lines TO authenticated;

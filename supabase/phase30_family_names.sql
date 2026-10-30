-- ═════════════════════════════════════════════════
--  Phase 30 — the family, listed by name at sign-up
--
--  When a family is created, its Key Member can list who else is in it,
--  and say who will manage the Kutumbh (the Key Member). These are
--  names on a list, not accounts: each person still joins with their
--  own login when invited, and keeps their own meals and reports.
--
--  Everyone in the Kutumbh can see the list; only the Key Member can
--  change it. Run once in the Supabase SQL editor. Safe to run again.
-- ═════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.kutumbh_planned_members (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kutumbh_id uuid NOT NULL REFERENCES public.kutumbhs(id) ON DELETE CASCADE,
  name       text NOT NULL CHECK (char_length(btrim(name)) BETWEEN 1 AND 60),
  email      text CHECK (email IS NULL OR char_length(email) <= 254),
  is_key     boolean NOT NULL DEFAULT false,   -- the person who will manage the Kutumbh once they join
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- At most one planned Key Member per Kutumbh
CREATE UNIQUE INDEX IF NOT EXISTS planned_one_key
  ON public.kutumbh_planned_members (kutumbh_id) WHERE is_key;

ALTER TABLE public.kutumbh_planned_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Members see the family list" ON public.kutumbh_planned_members;
CREATE POLICY "Members see the family list" ON public.kutumbh_planned_members
  FOR SELECT USING (kutumbh_id IN (SELECT public.my_kutumbh_ids()));

-- Only the Key Member (role = owner) writes
DROP POLICY IF EXISTS "Key Member adds names" ON public.kutumbh_planned_members;
CREATE POLICY "Key Member adds names" ON public.kutumbh_planned_members
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.kutumbh_members m
            WHERE m.kutumbh_id = kutumbh_planned_members.kutumbh_id
              AND m.user_id = auth.uid() AND m.role = 'owner')
  );

DROP POLICY IF EXISTS "Key Member edits names" ON public.kutumbh_planned_members;
CREATE POLICY "Key Member edits names" ON public.kutumbh_planned_members
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.kutumbh_members m
            WHERE m.kutumbh_id = kutumbh_planned_members.kutumbh_id
              AND m.user_id = auth.uid() AND m.role = 'owner')
  );

DROP POLICY IF EXISTS "Key Member removes names" ON public.kutumbh_planned_members;
CREATE POLICY "Key Member removes names" ON public.kutumbh_planned_members
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.kutumbh_members m
            WHERE m.kutumbh_id = kutumbh_planned_members.kutumbh_id
              AND m.user_id = auth.uid() AND m.role = 'owner')
  );

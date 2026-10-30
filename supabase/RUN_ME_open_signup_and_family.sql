-- ═════════════════════════════════════════════════════════════════
--  My Kutumb Bhojan — run ONCE in the Supabase SQL editor
--  Branch: open-signup-ux
--
--  Part 1 (phase 28): anyone may register; the Admin still approves.
--  Part 2 (phase 30): the family listed by name, with an editable
--                     Key Member choice.
--
--  Safe to run again: every statement is IF NOT EXISTS / DROP IF EXISTS.
--  Needs phases 3 (my_kutumbh_ids) and 24 (app_admissions) to be in
--  already, which they are on the live app.
-- ═════════════════════════════════════════════════════════════════

-- ───────────── PART 1 · phase 28 · open sign-up ─────────────
DROP FUNCTION IF EXISTS public.request_admission();

CREATE FUNCTION public.request_admission()
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_me  uuid := auth.uid();
  v_now text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not_signed_in'; END IF;

  SELECT status INTO v_now FROM app_admissions WHERE user_id = v_me;

  -- Already admitted, already waiting, or turned away: leave it as it is.
  -- A declined person cannot knock again and reverse the Admin's decision.
  IF v_now IS NOT NULL THEN RETURN v_now; END IF;

  INSERT INTO app_admissions (user_id, status)
  VALUES (v_me, 'waiting')
  ON CONFLICT (user_id) DO NOTHING;

  RETURN 'waiting';
END;
$$;

REVOKE ALL ON FUNCTION public.request_admission() FROM public;
GRANT EXECUTE ON FUNCTION public.request_admission() TO authenticated;

-- ───────────── PART 2 · phase 30 · family names ─────────────
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

-- ───────────── Check (optional): both should say what they are ─────────────
SELECT 'request_admission exists' AS check, to_regprocedure('public.request_admission()') IS NOT NULL AS ok
UNION ALL
SELECT 'kutumbh_planned_members exists', to_regclass('public.kutumbh_planned_members') IS NOT NULL;

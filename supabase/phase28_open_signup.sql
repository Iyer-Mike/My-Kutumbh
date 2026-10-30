-- ═════════════════════════════════════════════════
--  Phase 28 — anyone may register; the Admin still decides
--
--  Until now a person needed the Admin's passcode to register. Now
--  anyone can create an account, and lands in the waiting room. The
--  door itself is unchanged: nobody reaches the app, or spends a
--  rupee of AI, until the Admin approves them from the Admin Desk.
--
--  Run once in the Supabase SQL editor. Safe to run again.
-- ═════════════════════════════════════════════════

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

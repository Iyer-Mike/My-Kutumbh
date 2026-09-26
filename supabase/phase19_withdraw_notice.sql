-- ═══════════════════════════════════════════════════════════════════
--  Phase 19 — a letter can be withdrawn
--
--  Nothing sent from the Admin Desk could be taken back, which is a
--  poor property for a channel that reaches families: the first note
--  sent to the wrong household would have stood for ever.
--
--  Only the Admin may withdraw, and only their own letters — never a
--  family's reply, which is theirs and not the Admin's to erase.
-- ═══════════════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS admin_delete_notice(uuid);

CREATE FUNCTION admin_delete_notice(p_notice uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  gone integer;
BEGIN
  IF NOT is_app_admin() THEN
    RAISE EXCEPTION 'Not permitted';
  END IF;

  DELETE FROM notices
  WHERE id = p_notice
    AND from_admin = true;   -- a family's own words are not ours to erase

  GET DIAGNOSTICS gone = ROW_COUNT;
  RETURN gone > 0;
END;
$$;

REVOKE ALL ON FUNCTION admin_delete_notice(uuid) FROM public;
GRANT EXECUTE ON FUNCTION admin_delete_notice(uuid) TO authenticated;


-- ── Check: the function exists, and the letters still stand ──
SELECT proname AS function_name
FROM pg_proc
WHERE proname = 'admin_delete_notice';

SELECT id, title, from_admin, read_at FROM notices ORDER BY created_at DESC;

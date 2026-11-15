-- The Admin Desk: who was welcomed in or declined lately, so the Admin can tell them.
-- Nothing is sent to a newcomer by the decision itself. Safe to run more than once.

DROP FUNCTION IF EXISTS public.admin_recent_decisions();

CREATE FUNCTION public.admin_recent_decisions()
RETURNS TABLE (user_id uuid, full_name text, email text, status text, welcome text, decided_at timestamptz, has_family boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  RETURN QUERY
  SELECT a.user_id,
         COALESCE(p.full_name, u.raw_user_meta_data ->> 'full_name')::text,
         u.email::text,
         a.status::text,
         a.welcome::text,
         a.decided_at,
         EXISTS (SELECT 1 FROM kutumbh_members m WHERE m.user_id = a.user_id)
  FROM app_admissions a
  JOIN auth.users u ON u.id = a.user_id
  LEFT JOIN profiles p ON p.id = a.user_id
  WHERE a.status IN ('admitted', 'declined')
    AND a.decided_at > now() - interval '14 days'
    AND a.decided_by IS NOT NULL
  ORDER BY a.decided_at DESC
  LIMIT 20;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_recent_decisions() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_recent_decisions() TO authenticated;

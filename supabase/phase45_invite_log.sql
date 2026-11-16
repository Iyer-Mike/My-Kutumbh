-- The Admin Desk: what happened to each invitation, in words.
-- Adds the date an invitation was made (older ones have none) and a function
-- that says who was invited and how it ended. Safe to run more than once.

ALTER TABLE public.kutumbh_invites ADD COLUMN IF NOT EXISTS created_at timestamptz;
ALTER TABLE public.kutumbh_invites ALTER COLUMN created_at SET DEFAULT now();

CREATE OR REPLACE FUNCTION public.admin_invite_log()
RETURNS TABLE (kutumbh_name text, invited_name text, invited_email text, made timestamptz, expires timestamptz, state text, attempts integer, for_minor boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  IF NOT is_app_admin() THEN RAISE EXCEPTION 'not_permitted'; END IF;

  RETURN QUERY
  SELECT k.name::text,
         COALESCE(
           (SELECT pm.name::text FROM kutumbh_planned_members pm
             WHERE pm.kutumbh_id = i.kutumbh_id AND lower(pm.email) = lower(i.invited_email) LIMIT 1),
           (SELECT p.full_name::text FROM auth.users u JOIN profiles p ON p.id = u.id
             WHERE lower(u.email) = lower(i.invited_email) LIMIT 1)),
         i.invited_email::text,
         i.created_at,
         i.expires_at,
         (CASE WHEN COALESCE(i.used_count, 0) > 0 THEN 'joined'
               WHEN i.is_active AND i.expires_at > now() THEN 'open'
               WHEN i.is_active THEN 'expired'
               WHEN COALESCE(i.attempts, 0) >= 5 THEN 'closed_tries'
               ELSE 'closed' END)::text,
         COALESCE(i.attempts, 0)::integer,
         COALESCE(i.for_minor, false)
  FROM kutumbh_invites i
  JOIN kutumbhs k ON k.id = i.kutumbh_id
  ORDER BY i.expires_at DESC
  LIMIT 40;
END;
$$;
REVOKE ALL ON FUNCTION public.admin_invite_log() FROM public;
GRANT EXECUTE ON FUNCTION public.admin_invite_log() TO authenticated;

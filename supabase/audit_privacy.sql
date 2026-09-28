-- ═══════════════════════════════════════════════════════════════════
--  A privacy audit, before anyone outside this house uses the app
--
--  Read-only. It changes nothing. Four questions:
--
--    1. Does every table keep its row-level security switched on?
--    2. Do the VIEWS run as the person asking, or as their owner?
--    3. Which functions see everything, and do they check who is asking?
--    4. Are the photo and report stores private, with rules on them?
--
--  Question 2 is the one that catches people out. A view in Postgres
--  runs with its OWNER's rights unless it is explicitly told otherwise,
--  so a view over a protected table can hand out every row in it while
--  the table underneath looks perfectly locked.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Tables: is row-level security on, and how many rules? ──────
--  Anything with rls_on = false holding personal data is a hole.
SELECT c.relname                          AS table_name,
       c.relrowsecurity                   AS rls_on,
       count(p.polname)                   AS policies,
       string_agg(DISTINCT
         CASE p.polcmd WHEN 'r' THEN 'select' WHEN 'a' THEN 'insert'
                       WHEN 'w' THEN 'update' WHEN 'd' THEN 'delete'
                       ELSE 'all' END, ', ' ORDER BY
         CASE p.polcmd WHEN 'r' THEN 'select' WHEN 'a' THEN 'insert'
                       WHEN 'w' THEN 'update' WHEN 'd' THEN 'delete'
                       ELSE 'all' END)    AS covers
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity, c.relname;


-- ── 2 · Views: whose rights do they run with? ──────────────────────
--  security_invoker = off means the view ignores the caller's limits
--  and uses its owner's. For a view over family data, that is a leak.
SELECT c.relname AS view_name,
       COALESCE(
         (SELECT option_value FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'),
         'off (uses the owner''s rights)'
       ) AS security_invoker
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
ORDER BY c.relname;


-- ── 3 · Functions that see everything ──────────────────────────────
--  Each of these runs with its owner's rights. Every one must decide
--  for itself who is allowed to call it.
SELECT p.proname AS function_name,
       CASE WHEN pg_get_functiondef(p.oid) ~* 'is_app_admin|auth\.uid\(\)'
            THEN 'checks the caller'
            ELSE 'NO CHECK FOUND - look at this one'
       END AS caller_check,
       pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.prosecdef
ORDER BY 2 DESC, 1;


-- ── 4 · The photo and report stores ────────────────────────────────
SELECT b.id AS bucket, b.public AS is_public,
       (SELECT count(*) FROM pg_policy pol
        JOIN pg_class c ON c.oid = pol.polrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'storage' AND c.relname = 'objects'
          AND pg_get_expr(pol.polqual, pol.polrelid) LIKE '%' || b.id || '%')
       AS rules_naming_this_bucket
FROM storage.buckets b
ORDER BY b.id;

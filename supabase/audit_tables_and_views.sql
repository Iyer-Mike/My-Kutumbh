-- ═══════════════════════════════════════════════════════════════════
--  The two questions the audit has not yet answered
--
--  Read-only. Two result tables.
-- ═══════════════════════════════════════════════════════════════════

-- ── 1 · Tables with their protection off ───────────────────────────
--  Sorted so anything unprotected appears FIRST. An empty top of the
--  list is the good outcome.
SELECT c.relname        AS table_name,
       c.relrowsecurity AS rls_on,
       count(p.polname) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind = 'r'
GROUP BY c.relname, c.relrowsecurity
ORDER BY c.relrowsecurity ASC, count(p.polname) ASC, c.relname;


-- ── 2 · Views, and whose rights they use ───────────────────────────
--  A view runs with its OWNER's rights unless told otherwise, so a
--  view over a protected table can hand out every row in it while the
--  table underneath looks perfectly locked. family_roster is the one
--  that matters here: it feeds the faces and the member lists.
SELECT c.relname AS view_name,
       COALESCE(
         (SELECT option_value FROM pg_options_to_table(c.reloptions)
          WHERE option_name = 'security_invoker'),
         'OFF - runs as its owner'
       ) AS security_invoker,
       pg_get_userbyid(c.relowner) AS owner
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'v'
ORDER BY c.relname;

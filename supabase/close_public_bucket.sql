-- ═══════════════════════════════════════════════════════════════════
--  A bucket nobody uses, standing open to the world
--
--  The audit found "food-photos" marked public. A public bucket in
--  Supabase needs no sign-in: anyone holding an object's URL can read
--  it, and such URLs travel — in a shared screenshot, a browser
--  history, a chat message forwarded on.
--
--  Nothing in the app refers to it. Not one line of code uploads to or
--  reads from it, so it is a leftover from an earlier shape of the
--  project. Even so, whatever it holds is a family's food, from a
--  family's kitchen, and none of it was offered to the world.
--
--  This closes it. Read the first query before running the rest: if it
--  holds nothing, closing costs nothing; if it holds something, you
--  will want to know what before deciding.
-- ═══════════════════════════════════════════════════════════════════

-- ── What is actually in there ──
SELECT o.bucket_id,
       count(*)                                    AS files,
       pg_size_pretty(COALESCE(sum((o.metadata->>'size')::bigint), 0)) AS total_size,
       min(o.created_at)                           AS oldest,
       max(o.created_at)                           AS newest
FROM storage.objects o
WHERE o.bucket_id = 'food-photos'
GROUP BY o.bucket_id;

-- ── A few names, to recognise what they were ──
SELECT name, created_at, (metadata->>'size')::bigint AS bytes
FROM storage.objects
WHERE bucket_id = 'food-photos'
ORDER BY created_at DESC
LIMIT 10;


-- ── Close it ──
--  Marking it private does not delete anything. Existing links stop
--  working; the files stay until you decide about them.
UPDATE storage.buckets SET public = false WHERE id = 'food-photos';


-- ── Check: every bucket private ──
SELECT id AS bucket, public AS is_public FROM storage.buckets ORDER BY id;

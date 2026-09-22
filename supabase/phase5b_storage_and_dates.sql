-- ══════════════════════════════════════════════════════════════════
-- Phase 5b — Medical report file storage + India-time dates
-- Run once in Supabase SQL Editor. Safe to re-run.
-- ══════════════════════════════════════════════════════════════════


-- ── H1. medical-reports bucket: private, per-person folders ───────
-- Files are stored at "<user id>/<timestamp>.<ext>". Each person can
-- read, add, replace and delete only files in their own folder.
INSERT INTO storage.buckets (id, name, public)
VALUES ('medical-reports', 'medical-reports', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Own medical report files: read"   ON storage.objects;
DROP POLICY IF EXISTS "Own medical report files: add"    ON storage.objects;
DROP POLICY IF EXISTS "Own medical report files: update" ON storage.objects;
DROP POLICY IF EXISTS "Own medical report files: delete" ON storage.objects;

CREATE POLICY "Own medical report files: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'medical-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own medical report files: add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'medical-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own medical report files: update" ON storage.objects
  FOR UPDATE TO authenticated
  USING      (bucket_id = 'medical-reports' AND (storage.foldername(name))[1] = auth.uid()::text)
  WITH CHECK (bucket_id = 'medical-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Own medical report files: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'medical-reports' AND (storage.foldername(name))[1] = auth.uid()::text);

-- Earlier saves stored a public URL, which never opens for a private
-- bucket. Keep just the storage path; the app now makes short-lived
-- signed links on demand.
UPDATE public.medical_records
SET file_url = regexp_replace(file_url, '^.*/medical-reports/', '')
WHERE file_url LIKE 'http%/medical-reports/%';


-- ── H3. "Today" in India time, matching the app ──────────────────
-- The app always sends logged_date explicitly; this default only
-- guards any row inserted without one (it was the UTC date).
ALTER TABLE public.meal_logs
  ALTER COLUMN logged_date SET DEFAULT ((now() AT TIME ZONE 'Asia/Kolkata')::date);


-- ── Check: the four file rules should be listed ──────────────────
SELECT policyname, cmd
FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects' AND policyname LIKE 'Own medical report files%'
ORDER BY policyname;

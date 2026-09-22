-- ══════════════════════════════════════════════════════════════════
-- Phase 5d — Medical reports: each member sees their own; the Prime
-- Member sees everyone's (clarified 22 Sep 2026). Replaces phase5c's
-- family-wide viewing. Run once in Supabase SQL Editor. Safe to re-run.
--
-- Unchanged: members upload, change and delete only their own reports.
-- ══════════════════════════════════════════════════════════════════

-- Remove the family-wide viewing rules from phase5c
DROP POLICY IF EXISTS "Family can view medical records"   ON public.medical_records;
DROP POLICY IF EXISTS "Family medical report files: read" ON storage.objects;

-- The Prime Member can view every member's report records...
DROP POLICY IF EXISTS "Prime Member can view family medical records" ON public.medical_records;
CREATE POLICY "Prime Member can view family medical records" ON public.medical_records
  FOR SELECT USING (
    user_id IN (
      SELECT km.user_id FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_prime_kutumbh_ids())
    )
  );

-- ...and open their files
DROP POLICY IF EXISTS "Prime Member medical report files: read" ON storage.objects;
CREATE POLICY "Prime Member medical report files: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT km.user_id::text FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_prime_kutumbh_ids())
    )
  );

-- Check: expect "Prime Member can view…" + "Users can manage own…" for
-- medical_records, and 4 "Own…" + 1 "Prime Member…" for files. No "Family…" rows.
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE (schemaname = 'public' AND tablename = 'medical_records')
   OR (schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%medical report files%')
ORDER BY tablename, policyname;

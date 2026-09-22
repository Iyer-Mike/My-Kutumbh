-- ══════════════════════════════════════════════════════════════════
-- Phase 5c — Medical reports visible to the whole family
-- (Prime Member decision, 22 Sep 2026). Run AFTER phase5b. Safe to re-run.
--
-- Everyone in a Kutumbh can VIEW each other's medical reports and files.
-- Only the person themselves can add, change or delete their own.
-- ══════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "Family can view medical records" ON public.medical_records;
CREATE POLICY "Family can view medical records" ON public.medical_records
  FOR SELECT USING (
    user_id IN (
      SELECT km.user_id FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );

DROP POLICY IF EXISTS "Family medical report files: read" ON storage.objects;
CREATE POLICY "Family medical report files: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'medical-reports'
    AND (storage.foldername(name))[1] IN (
      SELECT km.user_id::text FROM public.kutumbh_members km
      WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids())
    )
  );

-- Check: expect 2 rows for medical_records (own + family) and 5 for the files (4 own + 1 family)
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE (schemaname = 'public' AND tablename = 'medical_records')
   OR (schemaname = 'storage' AND tablename = 'objects' AND policyname ILIKE '%medical report files%')
ORDER BY tablename, policyname;

-- ══════════════════════════════════════════════════
-- Phase 13 — Faces, instead of letters
--
-- Everyone in a Kutumbh gets a photograph: their own, and one of the family
-- together. Letters in coloured circles gave way to the people themselves.
--
-- Where they live: a private bucket, filed under the family they belong to
--   <kutumbh id>/<user id>-<stamp>.jpg   a member
--   <kutumbh id>/family-<stamp>.jpg      the family together
--
-- Who may see one: anyone in that Kutumbh, and nobody else — the folder is
-- the family, so the rule is one line. Who may set one: yourself, or the
-- Prime Member, for a grandmother who will never open the app.
--
-- Photographs are as private as a medical report. They are never public;
-- the app asks for a signed link each time, good for an hour.
--
-- Safe to run more than once.
-- ══════════════════════════════════════════════════

-- ── 1. Where the photo is remembered ──
ALTER TABLE public.profiles  ADD COLUMN IF NOT EXISTS photo_path text;
ALTER TABLE public.kutumbhs  ADD COLUMN IF NOT EXISTS photo_path text;

-- ── 2. The bucket, private ──
INSERT INTO storage.buckets (id, name, public)
VALUES ('family-photos', 'family-photos', false)
ON CONFLICT (id) DO UPDATE SET public = false;

DROP POLICY IF EXISTS "Family photos: read"   ON storage.objects;
DROP POLICY IF EXISTS "Family photos: add"    ON storage.objects;
DROP POLICY IF EXISTS "Family photos: update" ON storage.objects;
DROP POLICY IF EXISTS "Family photos: delete" ON storage.objects;

-- The first folder is the Kutumbh, so a family sees its own and no other
CREATE POLICY "Family photos: read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_kutumbh_ids() AS k)
  );

-- Adding, replacing and removing: your own face, or the Prime Member's doing
CREATE POLICY "Family photos: add" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'family-photos'
    AND (
      (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_prime_kutumbh_ids() AS k)
      OR (
        (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_kutumbh_ids() AS k)
        AND (storage.filename(name)) LIKE (auth.uid()::text || '-%')
      )
    )
  );

CREATE POLICY "Family photos: update" ON storage.objects
  FOR UPDATE TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND (
      (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_prime_kutumbh_ids() AS k)
      OR (storage.filename(name)) LIKE (auth.uid()::text || '-%')
    )
  )
  WITH CHECK (
    bucket_id = 'family-photos'
    AND (
      (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_prime_kutumbh_ids() AS k)
      OR (storage.filename(name)) LIKE (auth.uid()::text || '-%')
    )
  );

CREATE POLICY "Family photos: delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'family-photos'
    AND (
      (storage.foldername(name))[1] IN (SELECT k::text FROM public.my_prime_kutumbh_ids() AS k)
      OR (storage.filename(name)) LIKE (auth.uid()::text || '-%')
    )
  );

-- ── 3. Setting a face on a profile ──
-- A profile row stays closed: this is the one door into it, and it opens
-- only for that person or the Prime Member of their Kutumbh.
CREATE OR REPLACE FUNCTION public.set_member_photo(member uuid, path text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF member <> auth.uid() AND NOT EXISTS (
    SELECT 1 FROM public.kutumbh_members km
    WHERE km.user_id = member
      AND km.kutumbh_id IN (SELECT public.my_prime_kutumbh_ids())
  ) THEN
    RAISE EXCEPTION 'Only you or your Prime Member may change your photo';
  END IF;

  UPDATE public.profiles SET photo_path = path WHERE id = member;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_member_photo(uuid, text) TO authenticated;

-- ── 4. The roster carries the face ──
-- The family pages read names and Prakriti from here, never the whole
-- profile. The photo joins them.
DROP VIEW IF EXISTS public.family_roster;

CREATE VIEW public.family_roster
WITH (security_invoker = false) AS
  SELECT
    p.id,
    p.full_name,
    p.primary_dosha,
    p.photo_path,
    km.kutumbh_id,
    km.role
  FROM public.profiles p
  JOIN public.kutumbh_members km ON km.user_id = p.id
  WHERE km.kutumbh_id IN (SELECT public.my_kutumbh_ids());

GRANT SELECT ON public.family_roster TO authenticated;

-- Check: the bucket is private, the four rules are there, and the roster
-- now has a photo column
SELECT id, public FROM storage.buckets WHERE id = 'family-photos';

SELECT policyname FROM pg_policies
WHERE schemaname = 'storage' AND tablename = 'objects'
  AND policyname LIKE 'Family photos%'
ORDER BY policyname;

SELECT column_name FROM information_schema.columns
WHERE table_schema = 'public' AND table_name = 'family_roster'
ORDER BY ordinal_position;

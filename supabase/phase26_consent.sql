-- ═══════════════════════════════════════════════════════════════════
--  Phase 26 — asking, and writing down the answer
--
--  My Kutumbh holds blood reports, children's meals, allergies and
--  medicines. Until now nobody had been told, in one place, what is
--  held, who reads it, or where it lives — and nobody had been asked.
--
--  Two documents now exist in the repository (src/lib/legal.ts), and
--  this is where an answer to them is kept.
--
--  What makes it a record rather than a gesture:
--
--    · The VERSION and a FINGERPRINT of the exact words are stored
--      with each answer. Edit a paragraph and the fingerprint changes,
--      so nobody is counted as having agreed to words they never read
--      — even if whoever edited it forgot to bump the version.
--    · Only the member's own hand can write it. This is a consent
--      record; an Admin who could insert one could manufacture it.
--    · Nothing may be deleted or altered afterwards, by anybody, over
--      the API. Withdrawing consent is "Forget me", which removes the
--      account, and the row goes with it.
--
--  The gate that reads this lives in src/app/(app)/layout.tsx, beside
--  the admission gate, so agreement sits between being let in and
--  naming your Kutumbh.
-- ═══════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.consents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  doc         text NOT NULL,              -- 'privacy' | 'terms'
  version     text NOT NULL,              -- as the document declared it
  fingerprint text NOT NULL,              -- sha256 of the words themselves
  agreed_at   timestamptz NOT NULL DEFAULT now(),

  -- Agreed to on somebody else's behalf: a child in the household.
  -- Null for the ordinary case, which is almost every case.
  on_behalf_of uuid REFERENCES auth.users(id) ON DELETE CASCADE,

  CONSTRAINT consents_doc_known CHECK (doc IN ('privacy', 'terms'))
);

-- One answer per person, per document, per exact wording. Agreeing
-- twice to the same words is not a second consent.
CREATE UNIQUE INDEX IF NOT EXISTS consents_once
  ON public.consents (user_id, doc, fingerprint)
  WHERE on_behalf_of IS NULL;

CREATE INDEX IF NOT EXISTS consents_by_user ON public.consents (user_id);

ALTER TABLE public.consents ENABLE ROW LEVEL SECURITY;

-- ── Who may do what ───────────────────────────────────────────────
--  Read your own. Write your own, and only as yourself. Nothing else:
--  no UPDATE policy and no DELETE policy exist, so a consent cannot be
--  rewritten or quietly removed through the API by anyone at all.

DROP POLICY IF EXISTS "See my own consents" ON public.consents;
CREATE POLICY "See my own consents" ON public.consents
  FOR SELECT USING (user_id = auth.uid() OR on_behalf_of = auth.uid());

DROP POLICY IF EXISTS "Agree for myself" ON public.consents;
CREATE POLICY "Agree for myself" ON public.consents
  FOR INSERT WITH CHECK (user_id = auth.uid());


-- ── Everyone already inside ───────────────────────────────────────
--  Deliberately NOT backfilled. Four people are in the app today and
--  none of them has read these documents; writing rows on their behalf
--  would be inventing a consent. They meet the gate on their next
--  visit, like anyone else. That is the whole point of building it.


-- ── Check ─────────────────────────────────────────────────────────
SELECT count(*) AS consents_so_far FROM public.consents;

SELECT polname AS policy, polcmd AS command
FROM pg_policy WHERE polrelid = 'public.consents'::regclass
ORDER BY polname;

SELECT relrowsecurity AS rls_on FROM pg_class WHERE oid = 'public.consents'::regclass;

-- ═══════════════════════════════════════════════════════
--  My Kutumbh — Phase 1 Health Profile Extension
--  Run in: Supabase Dashboard → SQL Editor → New query
-- ═══════════════════════════════════════════════════════

-- ── 1. Extend profiles table ─────────────────────────────

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS diet_type      text CHECK (diet_type IN ('vegetarian','vegan','non_vegetarian','jain','eggetarian')),
  ADD COLUMN IF NOT EXISTS conditions     text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS allergies      text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS daily_kcal_goal integer;


-- ── 2. Medical records table ─────────────────────────────

CREATE TABLE IF NOT EXISTS public.medical_records (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_date      date,
  report_type      text,       -- AI-inferred: 'blood_test','lipid_panel','thyroid','kidney','liver','cbc','other'
  file_url         text,
  file_name        text,
  extracted_values jsonb,      -- { "hemoglobin": 12.4, "hba1c": 6.1, ... }
  notes            text,
  created_at       timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.medical_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own medical records"
  ON public.medical_records FOR ALL
  USING  (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

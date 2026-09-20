-- Phase 4: Add ingredients and preparation detail to food_items
ALTER TABLE public.food_items
  ADD COLUMN IF NOT EXISTS ingredients  text,
  ADD COLUMN IF NOT EXISTS preparation  text;

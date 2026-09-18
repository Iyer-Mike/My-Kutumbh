-- Add quantity_unit column to meal_logs
-- Run in Supabase SQL Editor
ALTER TABLE meal_logs ADD COLUMN IF NOT EXISTS quantity_unit TEXT DEFAULT 'serving';

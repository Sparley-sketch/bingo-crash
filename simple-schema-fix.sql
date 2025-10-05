-- Simple schema fix - just add the missing columns
-- Run this in your Supabase SQL editor

-- Add missing columns to rounds table (safe to run multiple times)
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS prebuy_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS round_starts_at timestamptz;

-- Verify the columns were added
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rounds' 
AND column_name IN ('prebuy_ends_at', 'round_starts_at');

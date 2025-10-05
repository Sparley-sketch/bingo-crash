-- Fix all missing columns in rounds table
-- Run this in your Supabase SQL Editor

-- Add all missing columns to rounds table
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS total_balls int DEFAULT 25,
ADD COLUMN IF NOT EXISTS winner_alias text,
ADD COLUMN IF NOT EXISTS winner_daubs int DEFAULT 0,
ADD COLUMN IF NOT EXISTS ended_at timestamptz,
ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Update existing records with default values
UPDATE public.rounds 
SET 
  total_balls = 25,
  winner_daubs = 0
WHERE total_balls IS NULL OR winner_daubs IS NULL;

-- Verify all columns exist
SELECT column_name, data_type, column_default, is_nullable
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test query to make sure everything works
SELECT id, phase, total_balls, winner_alias, winner_daubs, created_at
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 1;

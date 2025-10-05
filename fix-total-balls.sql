-- Fix missing total_balls column in rounds table
-- Run this in your Supabase SQL Editor

-- Add the missing total_balls column
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS total_balls int DEFAULT 25;

-- Update existing records to have a default value
UPDATE public.rounds 
SET total_balls = 25
WHERE total_balls IS NULL;

-- Verify the column was added
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

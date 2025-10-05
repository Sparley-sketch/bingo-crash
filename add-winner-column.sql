-- Add winner column to rounds table
-- Run this in your Supabase SQL Editor

-- Add the winner column if it doesn't exist
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS winner jsonb;

-- Update existing records to have null winner
UPDATE public.rounds 
SET winner = NULL 
WHERE winner IS NULL;

-- Test the column exists
SELECT 
  'Winner column added successfully' as status,
  column_name, 
  data_type 
FROM information_schema.columns 
WHERE table_name = 'rounds' 
  AND table_schema = 'public' 
  AND column_name = 'winner';

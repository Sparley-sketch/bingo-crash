-- Check if winner column exists in rounds table
-- Run this in your Supabase SQL Editor

-- Check the structure of the rounds table
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if winner column exists
SELECT 
  CASE 
    WHEN EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'rounds' 
      AND table_schema = 'public' 
      AND column_name = 'winner'
    ) 
    THEN 'Winner column EXISTS' 
    ELSE 'Winner column MISSING' 
  END as winner_column_status;

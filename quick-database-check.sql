-- Quick database check for rounds table
-- Run this in your Supabase SQL Editor

-- Check if rounds table exists and its structure
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check current round data
SELECT id, phase, called, speed_ms, created_at 
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 3;

-- Test if we can update the phase column
UPDATE public.rounds 
SET phase = 'test_update' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

-- Reset back to setup
UPDATE public.rounds 
SET phase = 'setup' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

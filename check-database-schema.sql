-- Check database schema for potential issues
-- Run this in your Supabase SQL Editor

-- Check if rounds table has all required columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any RLS policies on rounds table
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'rounds';

-- Test a simple update to see if it works
UPDATE public.rounds 
SET phase = 'test' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

-- Reset back to setup
UPDATE public.rounds 
SET phase = 'setup' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

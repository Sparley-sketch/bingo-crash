-- Clean up stuck live rounds
-- Run this in your Supabase SQL Editor

-- First, check what rounds exist and their phases
SELECT id, phase, created_at 
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there are any live rounds
SELECT COUNT(*) as live_rounds_count 
FROM public.rounds 
WHERE phase = 'live';

-- End any live rounds (set them to 'ended')
UPDATE public.rounds 
SET phase = 'ended' 
WHERE phase = 'live'
RETURNING id, phase, created_at;

-- Verify no live rounds remain
SELECT COUNT(*) as live_rounds_count 
FROM public.rounds 
WHERE phase = 'live';

-- Show current state
SELECT id, phase, created_at 
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 3;

-- Fix the one_live_round constraint issue
-- Run this in your Supabase SQL Editor

-- First, check what rounds exist and their phases
SELECT id, phase, created_at 
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 5;

-- Check if there's already a live round
SELECT COUNT(*) as live_rounds_count 
FROM public.rounds 
WHERE phase = 'live';

-- If there's a live round, end it first
UPDATE public.rounds 
SET phase = 'ended' 
WHERE phase = 'live';

-- Now drop the one_live_round constraint
ALTER TABLE public.rounds DROP CONSTRAINT IF EXISTS one_live_round;

-- Add a new constraint that allows multiple live rounds (or remove the constraint entirely)
-- For now, let's remove it completely since we want to allow multiple live rounds
-- ALTER TABLE public.rounds 
-- ADD CONSTRAINT one_live_round 
-- UNIQUE (phase) WHERE phase = 'live';

-- Test setting a round to live
UPDATE public.rounds 
SET phase = 'live' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

-- Reset back to setup
UPDATE public.rounds 
SET phase = 'setup' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

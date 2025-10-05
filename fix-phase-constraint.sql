-- Fix the phase constraint issue
-- Run this in your Supabase SQL Editor

-- Check what the current constraint allows
SELECT conname, pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'rounds_phase_check';

-- Drop the existing constraint
ALTER TABLE public.rounds DROP CONSTRAINT IF EXISTS rounds_phase_check;

-- Add a new constraint that allows the correct phase values
ALTER TABLE public.rounds 
ADD CONSTRAINT rounds_phase_check 
CHECK (phase IN ('setup', 'live', 'ended'));

-- Test the update again
UPDATE public.rounds 
SET phase = 'live' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

-- Reset back to setup
UPDATE public.rounds 
SET phase = 'setup' 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
RETURNING id, phase;

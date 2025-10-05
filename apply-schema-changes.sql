-- Apply database schema changes for consecutive games
-- Run this in your Supabase SQL editor

-- Add missing columns to rounds table
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS prebuy_ends_at timestamptz,
ADD COLUMN IF NOT EXISTS round_starts_at timestamptz;

-- Update the phase constraint to include new phases
-- First, drop any existing constraints
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.table_constraints 
               WHERE constraint_name LIKE '%phase%' 
               AND table_name = 'rounds') THEN
        ALTER TABLE public.rounds DROP CONSTRAINT IF EXISTS rounds_phase_check;
    END IF;
END $$;

-- Add new constraint for expanded phases
ALTER TABLE public.rounds 
ADD CONSTRAINT rounds_phase_check 
CHECK (phase IN ('setup', 'live', 'ended', 'prebuy', 'countdown'));

-- Verify the changes
SELECT column_name, data_type, is_nullable 
FROM information_schema.columns 
WHERE table_name = 'rounds' 
AND column_name IN ('prebuy_ends_at', 'round_starts_at');

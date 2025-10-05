-- Fix cards table schema to match API expectations
-- Run this in your Supabase SQL Editor

-- Add missing columns to cards table
ALTER TABLE public.cards 
ADD COLUMN IF NOT EXISTS name text,
ADD COLUMN IF NOT EXISTS grid jsonb,
ADD COLUMN IF NOT EXISTS just_exploded boolean DEFAULT false,
ADD COLUMN IF NOT EXISTS just_saved boolean DEFAULT false;

-- Update existing records with default values
UPDATE public.cards 
SET 
  name = 'Bingo Card',
  grid = '[]'::jsonb,
  just_exploded = false,
  just_saved = false
WHERE name IS NULL OR grid IS NULL OR just_exploded IS NULL OR just_saved IS NULL;

-- Test the schema
SELECT 'Cards schema updated successfully' as status;

-- Verify the cards table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'cards' AND table_schema = 'public'
ORDER BY ordinal_position;

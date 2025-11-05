-- Add missing 'completed' column to cards table for Scramblingo
ALTER TABLE public.cards ADD COLUMN IF NOT EXISTS completed BOOLEAN DEFAULT false;

-- Update existing cards to have completed = false
UPDATE public.cards SET completed = false WHERE completed IS NULL;



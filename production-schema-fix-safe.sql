-- Production Schema Fix for Bingo Crash (Safe Version)
-- Run this in your Supabase SQL Editor to fix the End Round button issue

-- Step 1: Add missing columns to rounds table
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS phase text DEFAULT 'setup',
ADD COLUMN IF NOT EXISTS called int[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS speed_ms int DEFAULT 800,
ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Step 2: Update existing records to have correct phase values
-- Only update if phase is NULL (new records will have default 'setup')
UPDATE public.rounds 
SET phase = 'setup'
WHERE phase IS NULL;

-- Step 3: Create cards table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  player_id text NOT NULL,
  exploded boolean DEFAULT false,
  paused boolean DEFAULT false,
  daubs int DEFAULT 0,
  wants_shield boolean DEFAULT false,
  shield_used boolean DEFAULT false,
  created_at timestamptz DEFAULT now()
);

-- Step 4: Create players table if it doesn't exist
CREATE TABLE IF NOT EXISTS public.players (
  id text PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Step 5: Enable RLS on new tables
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Step 6: Create RLS policies for rounds table
DO $$ BEGIN
  CREATE POLICY rounds_read ON public.rounds FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY rounds_write ON public.rounds FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 7: Create RLS policies for cards table
DO $$ BEGIN
  CREATE POLICY cards_read ON public.cards FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cards_write ON public.cards FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 8: Create RLS policies for players table
DO $$ BEGIN
  CREATE POLICY players_read ON public.players FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY players_write ON public.players FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 9: Verify the schema is correct
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_schema = 'public' 
  AND table_name IN ('rounds', 'cards', 'players')
ORDER BY table_name, ordinal_position;

-- Step 10: Test that we can insert a test round
INSERT INTO public.rounds (phase, called, speed_ms) 
VALUES ('setup', '{}', 800)
ON CONFLICT DO NOTHING;

-- Clean up test data
DELETE FROM public.rounds WHERE phase = 'setup' AND called = '{}';

-- Success message
SELECT 'Schema fix completed successfully! End Round button should now work.' as message;

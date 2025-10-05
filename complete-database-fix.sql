-- Complete database fix for Bingo Crash
-- Run this in your Supabase SQL Editor

-- Step 1: Fix rounds table with all required columns
ALTER TABLE public.rounds 
ADD COLUMN IF NOT EXISTS total_balls int DEFAULT 25,
ADD COLUMN IF NOT EXISTS winner_alias text,
ADD COLUMN IF NOT EXISTS winner_daubs int DEFAULT 0,
ADD COLUMN IF NOT EXISTS ended_at timestamptz,
ADD COLUMN IF NOT EXISTS started_at timestamptz;

-- Step 2: Ensure cards table exists with correct structure
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

-- Step 3: Ensure players table exists with correct structure
CREATE TABLE IF NOT EXISTS public.players (
  id text PRIMARY KEY,
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Step 4: Enable RLS on all tables
ALTER TABLE public.config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Step 5: Create RLS policies
DO $$ BEGIN
  CREATE POLICY config_read ON public.config FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY config_write ON public.config FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY rounds_read ON public.rounds FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY rounds_write ON public.rounds FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cards_read ON public.cards FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY cards_write ON public.cards FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY players_read ON public.players FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY players_write ON public.players FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Step 6: Update existing records
UPDATE public.rounds 
SET 
  total_balls = 25,
  winner_daubs = 0
WHERE total_balls IS NULL OR winner_daubs IS NULL;

-- Step 7: Test the tables
SELECT 'Tables created successfully' as status;

-- Verify rounds table structure
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'rounds' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Test cards table query (this should not fail)
SELECT COUNT(*) as card_count FROM public.cards WHERE exploded = false AND paused = false;

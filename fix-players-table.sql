-- Fix players table to auto-generate IDs
-- Run this in your Supabase SQL Editor

-- Drop and recreate players table with proper ID generation
DROP TABLE IF EXISTS public.players CASCADE;

CREATE TABLE public.players (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id uuid REFERENCES rounds(id) ON DELETE CASCADE,
  alias text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Re-enable RLS
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

-- Recreate RLS policies
DO $$ BEGIN
  CREATE POLICY players_read ON public.players FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY players_write ON public.players FOR ALL TO service_role USING (true);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Test the table
SELECT 'Players table fixed successfully' as status;

-- Verify the structure
SELECT column_name, data_type, column_default
FROM information_schema.columns 
WHERE table_name = 'players' AND table_schema = 'public'
ORDER BY ordinal_position;

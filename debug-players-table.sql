-- Debug players table structure
-- Run this in your Supabase SQL Editor

-- Check if players table exists and its structure
SELECT 
  table_name, 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'players' AND table_schema = 'public'
ORDER BY ordinal_position;

-- Check if there are any existing players
SELECT COUNT(*) as player_count FROM public.players;

-- Test inserting a player (this will show us the exact error)
INSERT INTO public.players (id, round_id, alias) 
VALUES ('test-player-' || extract(epoch from now()), 
        (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1), 
        'test-alias')
RETURNING *;

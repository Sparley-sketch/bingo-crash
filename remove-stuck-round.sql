-- Remove stuck round and all associated data
-- Run this in your Supabase SQL Editor

-- First, get the current round ID
SELECT 'Current round ID:' as info, id, phase, created_at
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 1;

-- Delete all cards associated with the current round
DELETE FROM public.cards 
WHERE round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Delete all players associated with the current round
DELETE FROM public.players 
WHERE round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Delete the stuck round itself
DELETE FROM public.rounds 
WHERE id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Verify cleanup
SELECT 'Remaining rounds:' as info, COUNT(*) as count
FROM public.rounds;

SELECT 'Remaining players:' as info, COUNT(*) as count
FROM public.players;

SELECT 'Remaining cards:' as info, COUNT(*) as count
FROM public.cards;

-- Show any remaining rounds
SELECT 'Remaining rounds data:' as info, id, phase, created_at
FROM public.rounds 
ORDER BY created_at DESC;

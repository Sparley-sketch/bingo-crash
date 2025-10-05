-- Debug player and card counting issue
-- Run this in your Supabase SQL Editor

-- Check what's in the players table
SELECT 'Players table:' as table_name, COUNT(*) as count
FROM public.players
UNION ALL
SELECT 'Players in current round:' as table_name, COUNT(*) as count
FROM public.players p
JOIN public.rounds r ON p.round_id = r.id
WHERE r.id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Check what's in the cards table
SELECT 'Cards table:' as table_name, COUNT(*) as count
FROM public.cards
UNION ALL
SELECT 'Cards in current round:' as table_name, COUNT(*) as count
FROM public.cards c
JOIN public.rounds r ON c.round_id = r.id
WHERE r.id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Check live cards specifically
SELECT 'Live cards in current round:' as table_name, COUNT(*) as count
FROM public.cards c
JOIN public.rounds r ON c.round_id = r.id
WHERE r.id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
AND c.exploded = false 
AND c.paused = false;

-- Show actual data
SELECT 'Current round data:' as info, id, phase, created_at
FROM public.rounds 
ORDER BY created_at DESC 
LIMIT 1;

-- Show players in current round
SELECT 'Players in current round:' as info, p.id, p.alias, p.created_at
FROM public.players p
JOIN public.rounds r ON p.round_id = r.id
WHERE r.id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

-- Show cards in current round
SELECT 'Cards in current round:' as info, c.id, c.player_id, c.exploded, c.paused, c.created_at
FROM public.cards c
JOIN public.rounds r ON c.round_id = r.id
WHERE r.id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

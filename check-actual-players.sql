-- Check what players actually exist in the database
-- Run this in your Supabase SQL Editor

-- Show all players in the current round
SELECT 
  'Current round players:' as info,
  p.id as player_id,
  p.alias,
  p.created_at,
  COUNT(c.id) as card_count
FROM public.players p
LEFT JOIN public.cards c ON p.id::text = c.player_id
WHERE p.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
GROUP BY p.id, p.alias, p.created_at
ORDER BY p.created_at;

-- Show all cards in the current round
SELECT 
  'Current round cards:' as info,
  c.id as card_id,
  c.player_id,
  p.alias,
  c.name as card_name,
  c.created_at
FROM public.cards c
JOIN public.players p ON c.player_id = p.id::text
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
ORDER BY c.created_at;

-- Summary counts
SELECT 
  'Summary:' as info,
  COUNT(DISTINCT p.id) as unique_players,
  COUNT(c.id) as total_cards
FROM public.players p
LEFT JOIN public.cards c ON p.id::text = c.player_id
WHERE p.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

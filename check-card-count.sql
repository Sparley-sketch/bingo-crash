-- Check card count issue
-- Run this in your Supabase SQL Editor

-- Show all cards in the current round with details
SELECT 
  'Card details:' as info,
  c.id as card_id,
  c.player_id,
  p.alias,
  c.name as card_name,
  c.exploded,
  c.paused,
  c.created_at
FROM public.cards c
JOIN public.players p ON c.player_id = p.id::text
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
ORDER BY c.created_at;

-- Count cards by player
SELECT 
  'Cards per player:' as info,
  p.alias,
  COUNT(c.id) as card_count
FROM public.players p
LEFT JOIN public.cards c ON p.id::text = c.player_id
WHERE p.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
GROUP BY p.id, p.alias
ORDER BY p.created_at;

-- Total counts
SELECT 
  'Total counts:' as info,
  COUNT(DISTINCT p.id) as unique_players,
  COUNT(c.id) as total_cards,
  COUNT(CASE WHEN c.exploded = false AND c.paused = false THEN 1 END) as live_cards
FROM public.players p
LEFT JOIN public.cards c ON p.id::text = c.player_id
WHERE p.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

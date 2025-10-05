-- Debug card status issue
-- Run this in your Supabase SQL Editor

-- Check all cards in current round with their status
SELECT 
  'All cards in current round:' as info,
  c.id as card_id,
  c.player_id,
  p.alias,
  c.exploded,
  c.paused,
  c.daubs,
  c.shield_used,
  c.created_at
FROM public.cards c
JOIN public.players p ON c.player_id = p.id::text
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
ORDER BY c.created_at;

-- Check live cards count (what the API uses)
SELECT 
  'Live cards count (exploded=false AND paused=false):' as info,
  COUNT(*) as live_count
FROM public.cards c
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
  AND c.exploded = false 
  AND c.paused = false;

-- Check exploded cards count
SELECT 
  'Exploded cards count:' as info,
  COUNT(*) as exploded_count
FROM public.cards c
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
  AND c.exploded = true;

-- Check paused cards count  
SELECT 
  'Paused cards count:' as info,
  COUNT(*) as paused_count
FROM public.cards c
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1)
  AND c.paused = true;

-- Summary
SELECT 
  'Summary:' as info,
  COUNT(*) as total_cards,
  COUNT(CASE WHEN exploded = false AND paused = false THEN 1 END) as live_cards,
  COUNT(CASE WHEN exploded = true THEN 1 END) as exploded_cards,
  COUNT(CASE WHEN paused = true THEN 1 END) as paused_cards
FROM public.cards c
WHERE c.round_id = (SELECT id FROM public.rounds ORDER BY created_at DESC LIMIT 1);

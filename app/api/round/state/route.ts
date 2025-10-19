import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Simple in-memory cache for round state (short-lived)
let lastRoundState: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 50; // Back to 50ms for more responsive updates

export async function GET() {
  const startTime = Date.now();
  const now = Date.now();
  
  // Return cached response if available and recent
  if (lastRoundState && (now - lastCacheTime) < CACHE_DURATION) {
    const responseTime = Date.now() - startTime;
    if (responseTime > 50) {
      console.warn(`⚠️  SLOW CACHED RESPONSE: ${responseTime}ms`);
    }
    return NextResponse.json(lastRoundState, { headers: { 'Cache-Control': 'no-store' }});
  }
  
  try {
    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      return NextResponse.json({
        id: null,
        phase: 'setup',
        called: [],
        speed_ms: 800,
        live_cards_count: 0,
        player_count: 0
      }, { headers: { 'Cache-Control': 'no-store' }});
    }

    // Optimize: Use count queries instead of fetching all data
    // Only fetch counts if we need them (during live phase or when checking for game end)
    let liveCardsCount = 0;
    let playerCount = 0;
    
    if (round.phase === 'live' || round.phase === 'ended') {
      const [liveCardsResult, playersResult] = await Promise.all([
        supabaseAdmin
          .from(tableNames.cards)
          .select('id', { count: 'exact', head: true })
          .eq('round_id', round.id)
          .eq('exploded', false)
          .eq('paused', false),
        supabaseAdmin
          .from(tableNames.players)
          .select('id', { count: 'exact', head: true })
          .eq('round_id', round.id)
      ]);

      liveCardsCount = liveCardsResult.count || 0;
      playerCount = playersResult.count || 0;
    }

    // Auto-end game when all cards are exploded or locked (live_cards_count = 0)
    if (round.phase === 'live' && liveCardsCount === 0) {
      // Compute winner before ending the round
      let winner = null;
      if (playerCount > 0) {
        // Get all cards with their daubs count to find the winner
        const { data: allCardsData, error: allCardsError } = await supabaseAdmin
          .from(tableNames.cards)
          .select('player_id, daubs, exploded, paused')
          .eq('round_id', round.id);

        if (!allCardsError && allCardsData) {
          // Group by player and find the best daubs count from NON-EXPLODED cards only
          // Only live cards should count for winner determination
          const playerStats = new Map();
          allCardsData.forEach(card => {
            // Only count non-exploded cards for winner determination
            if (!card.exploded) {
              const playerId = card.player_id;
              if (!playerStats.has(playerId)) {
                playerStats.set(playerId, { maxDaubs: 0, alias: null });
              }
              const stats = playerStats.get(playerId);
              stats.maxDaubs = Math.max(stats.maxDaubs, card.daubs);
            }
          });

          // Find the player(s) with the highest daubs from non-exploded cards only
          let bestDaubs = -1;
          let bestPlayerIds = [];
          for (const [playerId, stats] of playerStats) {
            if (stats.maxDaubs > bestDaubs) {
              bestDaubs = stats.maxDaubs;
              bestPlayerIds = [playerId];
            } else if (stats.maxDaubs === bestDaubs && bestDaubs >= 0) {
              bestPlayerIds.push(playerId);
            }
          }

          // Get the winner(s) alias (only if there are non-exploded cards)
          if (bestPlayerIds.length > 0 && bestDaubs >= 0) {
            if (bestPlayerIds.length === 1) {
              // Single winner
              const { data: winnerPlayer, error: winnerError } = await supabaseAdmin
                .from(tableNames.players)
                .select('alias')
                .eq('id', bestPlayerIds[0])
                .single();

              if (!winnerError && winnerPlayer) {
                winner = { alias: winnerPlayer.alias, daubs: bestDaubs };
              }
            } else {
              // Multiple winners (tie)
              const { data: winnerPlayers, error: winnerError } = await supabaseAdmin
                .from(tableNames.players)
                .select('alias')
                .in('id', bestPlayerIds);

              if (!winnerError && winnerPlayers && winnerPlayers.length > 0) {
                const aliases = winnerPlayers.map(p => p.alias).join(' and ');
                winner = { alias: `DRAW between ${aliases}`, daubs: bestDaubs };
              }
            }
          } else {
            // All cards exploded - no winner (all cards were exploded)
            winner = { alias: '—', daubs: 0 };
          }
        }
      }
      
      // End the round with winner information
      const { error: endError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ 
          phase: 'ended',
          ended_at: new Date().toISOString(),
          winner_alias: winner?.alias || null,
          winner_daubs: winner?.daubs || 0
        })
        .eq('id', round.id);

      if (!endError) {
        // Update the round object for the response
        round.phase = 'ended';
        round.ended_at = new Date().toISOString();
        round.winner_alias = winner?.alias || null;
        round.winner_daubs = winner?.daubs || 0;
      }
    }

    
    // Construct winner object from separate fields
    const winner = round.winner_alias ? {
      alias: round.winner_alias,
      daubs: round.winner_daubs || 0
    } : null;

    const responseTime = Date.now() - startTime;
    
    // Log slow responses
    if (responseTime > 200) {
      console.warn(`⚠️  SLOW ROUND STATE API: ${responseTime}ms (Round: ${round.id})`);
    }
    
    const responseData = {
      id: round.id,
      phase: round.phase,
      called: round.called || [],
      speed_ms: round.speed_ms || 800,
      live_cards_count: liveCardsCount,
      player_count: playerCount,
      winner: winner,
      prize_pool: round.prize_pool || 0,
      total_collected: round.total_collected || 0
    };
    
    // Update cache
    lastRoundState = responseData;
    lastCacheTime = Date.now();
    
    return NextResponse.json(responseData, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in state endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

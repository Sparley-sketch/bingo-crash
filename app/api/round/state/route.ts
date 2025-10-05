import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
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

    // Get live cards count
    const { data: liveCardsData, error: liveCardsError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('round_id', round.id)
      .eq('exploded', false)
      .eq('paused', false);

    if (liveCardsError) {
      console.error('Error fetching live cards:', liveCardsError);
    }

    // Get player count
    const { data: playersData, error: playersError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('round_id', round.id);

    if (playersError) {
      console.error('Error fetching players:', playersError);
    }

    const liveCardsCount = liveCardsData?.length || 0;
    const playerCount = playersData?.length || 0;

    // Auto-end game when all cards are exploded or locked (live_cards_count = 0)
    if (round.phase === 'live' && liveCardsCount === 0) {
      // Compute winner before ending the round
      let winner = null;
      if (playerCount > 0) {
        // Get all cards with their daubs count to find the winner
        const { data: allCardsData, error: allCardsError } = await supabaseAdmin
          .from('cards')
          .select('player_id, daubs, exploded, paused')
          .eq('round_id', round.id);

        if (!allCardsError && allCardsData) {
          // Group by player and find the best daubs count
          const playerStats = new Map();
          allCardsData.forEach(card => {
            const playerId = card.player_id;
            if (!playerStats.has(playerId)) {
              playerStats.set(playerId, { maxDaubs: 0, alias: null });
            }
            const stats = playerStats.get(playerId);
            stats.maxDaubs = Math.max(stats.maxDaubs, card.daubs);
          });

          // Find the player with the highest daubs
          let bestDaubs = -1;
          let bestPlayerId = null;
          for (const [playerId, stats] of playerStats) {
            if (stats.maxDaubs > bestDaubs) {
              bestDaubs = stats.maxDaubs;
              bestPlayerId = playerId;
            }
          }

          // Get the winner's alias
          if (bestPlayerId) {
            const { data: winnerPlayer, error: winnerError } = await supabaseAdmin
              .from('players')
              .select('alias')
              .eq('id', bestPlayerId)
              .single();

            if (!winnerError && winnerPlayer) {
              winner = { alias: winnerPlayer.alias, daubs: bestDaubs };
            }
          }
        }
      }
      
      // End the round with winner information
      const { error: endError } = await supabaseAdmin
        .from('rounds')
        .update({ 
          phase: 'ended',
          ended_at: new Date().toISOString(),
          winner: winner
        })
        .eq('id', round.id);

      if (!endError) {
        // Update the round object for the response
        round.phase = 'ended';
        round.ended_at = new Date().toISOString();
        round.winner = winner;
      }
    }

    
    return NextResponse.json({
      id: round.id,
      phase: round.phase,
      called: round.called || [],
      speed_ms: round.speed_ms || 800,
      live_cards_count: liveCardsCount,
      player_count: playerCount,
      winner: round.winner || null
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in state endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

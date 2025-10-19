import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { alias } = await req.json().catch(() => ({}));
    if (!alias) return NextResponse.json({ error: 'alias required' }, { status: 400 });

    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id, phase')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    // Check if player exists
    const { data: player, error: playerError } = await supabaseAdmin
      .from(tableNames.players)
      .select('id')
      .eq('round_id', round.id)
      .eq('alias', alias)
      .single();

    if (playerError && playerError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Player not found' }, { status: 400 });
    } else if (playerError) {
      console.error('Error fetching player:', playerError);
      return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
    }

    // Update player's posted_out status (telemetry only)
    const { error: updateError } = await supabaseAdmin
      .from(tableNames.players)
      .update({ posted_out: true })
      .eq('id', player.id);

    if (updateError) {
      console.error('Error updating player status:', updateError);
    }

    // Check if game should end (when live cards = 0)
    if (round.phase === 'live') {
      const { data: liveCardsData, error: liveCardsError } = await supabaseAdmin
        .from(tableNames.cards)
        .select('id')
        .eq('round_id', round.id)
        .eq('exploded', false)
        .eq('paused', false);

      if (!liveCardsError && liveCardsData?.length === 0) {
        // Determine winner before ending the game
        let winner = null;
        
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
            // All cards exploded - no winner
            winner = { alias: '—', daubs: 0 };
          }
        }

        // End the game with winner information
        const { error: endError } = await supabaseAdmin
          .from(tableNames.rounds)
          .update({ 
            phase: 'ended',
            ended_at: new Date().toISOString(),
            winner_alias: winner?.alias || null,
            winner_daubs: winner?.daubs || 0
          })
          .eq('id', round.id);

        if (endError) {
          console.error('Error ending round:', endError);
        }
      }
    }
    
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in out endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

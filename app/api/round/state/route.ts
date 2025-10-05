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

    // Check if game should end (when live cards = 0)
    if (round.phase === 'live' && liveCardsCount === 0) {
      // End the game
      const { error: updateError } = await supabaseAdmin
        .from('rounds')
        .update({ phase: 'ended' })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error ending round:', updateError);
      } else {
        round.phase = 'ended';
      }
    }

    console.log(`State endpoint: phase=${round.phase}, live_cards=${liveCardsCount}, players=${playerCount}, called=${round.called?.length || 0}`);
    
    return NextResponse.json({
      id: round.id,
      phase: round.phase,
      called: round.called || [],
      speed_ms: round.speed_ms || 800,
      live_cards_count: liveCardsCount,
      player_count: playerCount
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in state endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

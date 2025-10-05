import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { alias } = await req.json().catch(() => ({}));
    if (!alias) return NextResponse.json({ error: 'alias required' }, { status: 400 });

    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
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
      .from('players')
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
      .from('players')
      .update({ posted_out: true })
      .eq('id', player.id);

    if (updateError) {
      console.error('Error updating player status:', updateError);
    }

    // Check if game should end (when live cards = 0)
    if (round.phase === 'live') {
      const { data: liveCardsData, error: liveCardsError } = await supabaseAdmin
        .from('cards')
        .select('id')
        .eq('round_id', round.id)
        .eq('exploded', false)
        .eq('paused', false);

      if (!liveCardsError && liveCardsData?.length === 0) {
        // End the game
        const { error: endError } = await supabaseAdmin
          .from('rounds')
          .update({ phase: 'ended' })
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

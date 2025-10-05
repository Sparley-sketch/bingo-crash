import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { alias, cardId } = await req.json().catch(() => ({}));
    
    if (!alias) return NextResponse.json({ error: 'alias required' }, { status: 400 });
    if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
      .select('id')
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

    // Find the player
    const { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('round_id', round.id)
      .eq('alias', alias)
      .single();

    if (playerError && playerError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    } else if (playerError) {
      console.error('Error fetching player:', playerError);
      return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
    }

    // Find the card
    const { data: card, error: cardError } = await supabaseAdmin
      .from('cards')
      .select('id, exploded, shield_used')
      .eq('id', cardId)
      .eq('player_id', player.id)
      .single();

    if (cardError && cardError.code === 'PGRST116') {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    } else if (cardError) {
      console.error('Error fetching card:', cardError);
      return NextResponse.json({ error: 'Failed to fetch card' }, { status: 500 });
    }

    if (card.exploded) {
      return NextResponse.json({ error: 'Card already exploded' }, { status: 400 });
    }

    if (card.shield_used) {
      return NextResponse.json({ error: 'Shield already used' }, { status: 400 });
    }

    // Purchase shield for the card
    const { error: updateError } = await supabaseAdmin
      .from('cards')
      .update({ wants_shield: true })
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating shield:', updateError);
      return NextResponse.json({ error: 'Failed to purchase shield' }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      message: 'Shield purchased successfully' 
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in shield endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

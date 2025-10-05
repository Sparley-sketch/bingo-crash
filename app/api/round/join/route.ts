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

    // Check if player already exists
    const { data: existingPlayer, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('round_id', round.id)
      .eq('alias', alias)
      .single();

    if (playerError && playerError.code !== 'PGRST116') {
      console.error('Error checking existing player:', playerError);
    }

    // Create player if they don't exist
    if (!existingPlayer) {
      const { error: insertError } = await supabaseAdmin
        .from('players')
        .insert([{ round_id: round.id, alias }]);

      if (insertError) {
        console.error('Error creating player:', insertError);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in join endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

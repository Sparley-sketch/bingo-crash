import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST() {
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
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    if (round.phase === 'live') {
      // End the round
      const { error: updateError } = await supabaseAdmin
        .from('rounds')
        .update({ phase: 'ended' })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error ending round:', updateError);
        return NextResponse.json({ error: 'Failed to end round' }, { status: 500 });
      }

      console.log(`Round ${round.id} ended manually`);
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in end endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

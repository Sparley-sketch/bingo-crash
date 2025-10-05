import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
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

    if (round.phase !== 'ended') {
      return NextResponse.json({ error: 'Round not ended' }, { status: 409 });
    }

    const { alias, daubs } = await req.json().catch(() => ({}));
    if (alias && typeof daubs === 'number') {
      // Update winner in database
      const { error: updateError } = await supabaseAdmin
        .from('rounds')
        .update({ winner: { alias, daubs } })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error updating winner:', updateError);
        return NextResponse.json({ error: 'Failed to update winner' }, { status: 500 });
      }
    }

    return NextResponse.json({ 
      ok: true, 
      winner: round.winner || null 
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in winner endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get current round with all columns to avoid missing column errors
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
      return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' }});
    }

    return NextResponse.json(round.winner ?? null, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in winner GET endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

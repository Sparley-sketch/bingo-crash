import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('End round endpoint called');
    
    // Try to get roundId from request body if provided
    let roundId = null;
    try {
      const body = await req.json().catch(() => ({}));
      roundId = body.roundId;
    } catch {
      // No body or invalid JSON, continue without roundId
    }
    
    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('Round data:', { round, roundError, requestedRoundId: roundId });

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      console.log('No round found');
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    console.log(`Current round phase: ${round.phase}`);

    if (round.phase === 'live') {
      console.log('Ending round and starting consecutive games cycle...');
      
      const now = new Date();
      const prebuyEndsAt = new Date(now.getTime() + 30 * 1000); // 30 seconds from now
      const roundStartsAt = new Date(now.getTime() + 35 * 1000); // 35 seconds from now
      
      // End the round and start prebuy phase
      const { error: updateError } = await supabaseAdmin
        .from('rounds')
        .update({ 
          phase: 'prebuy',
          ended_at: now.toISOString(),
          prebuy_ends_at: prebuyEndsAt.toISOString(),
          round_starts_at: roundStartsAt.toISOString()
        })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error ending round:', updateError);
        return NextResponse.json({ error: 'Failed to end round' }, { status: 500 });
      }

      console.log(`Round ${round.id} ended, prebuy phase started until ${prebuyEndsAt.toISOString()}`);
    } else {
      console.log(`Round is not live (phase: ${round.phase}), not ending`);
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in end endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

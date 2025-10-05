import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Auto-transition endpoint called');
    
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
      console.log('No round found');
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    const now = new Date();
    console.log(`Checking auto-transitions for round ${round.id}, phase: ${round.phase}`);

    // Check if we need to transition from prebuy to countdown
    if (round.phase === 'prebuy' && round.prebuy_ends_at) {
      const prebuyEndsAt = new Date(round.prebuy_ends_at);
      if (now >= prebuyEndsAt) {
        console.log('Transitioning from prebuy to countdown');
        
        const { error: updateError } = await supabaseAdmin
          .from('rounds')
          .update({ phase: 'countdown' })
          .eq('id', round.id);

        if (updateError) {
          console.error('Error transitioning to countdown:', updateError);
          return NextResponse.json({ error: 'Failed to transition' }, { status: 500 });
        }

        console.log(`Round ${round.id} transitioned to countdown phase`);
        return NextResponse.json({ transitioned: true, newPhase: 'countdown' });
      }
    }

    // Check if we need to auto-start the round from countdown
    if (round.phase === 'countdown' && round.round_starts_at) {
      const roundStartsAt = new Date(round.round_starts_at);
      if (now >= roundStartsAt) {
        console.log('Auto-starting new round from countdown');
        
        // Create a new round
        const { data: newRound, error: createError } = await supabaseAdmin
          .from('rounds')
          .insert([{
            phase: 'live',
            started_at: now.toISOString(),
            seed: Math.random().toString(36).substring(2)
          }])
          .select()
          .single();

        if (createError) {
          console.error('Error creating new round:', createError);
          return NextResponse.json({ error: 'Failed to create new round' }, { status: 500 });
        }

        console.log(`New round ${newRound.id} auto-started`);
        return NextResponse.json({ transitioned: true, newPhase: 'live', newRoundId: newRound.id });
      }
    }

    // No transitions needed
    return NextResponse.json({ transitioned: false, currentPhase: round.phase });
  } catch (error) {
    console.error('Unexpected error in auto-transition endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

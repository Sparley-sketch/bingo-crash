import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    
    console.log('End round endpoint called');
    
    // Try to get roundId from request body if provided
    let roundId = null;
    try {
      const body = await req.json().catch(() => ({}));
      roundId = body.roundId;
    } catch {
      // No body or invalid JSON, continue without roundId
    }
    
    // First, check if there are any stuck live rounds
    const { data: stuckRounds, error: stuckError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .eq('phase', 'live');

    console.log('Stuck live rounds:', stuckRounds);

    if (stuckRounds && stuckRounds.length > 0) {
      console.log(`Found ${stuckRounds.length} stuck live rounds, ending them all`);
      
      // End all stuck live rounds
      const { error: endAllError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ 
          phase: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('phase', 'live');

      if (endAllError) {
        console.error('Error ending stuck rounds:', endAllError);
        return NextResponse.json({ error: `Failed to end stuck rounds: ${endAllError.message}` }, { status: 500 });
      }

      console.log('Successfully ended all stuck live rounds');
      return NextResponse.json({ 
        message: 'Ended stuck live rounds', 
        endedCount: stuckRounds.length,
        rounds: stuckRounds.map(r => ({ id: r.id, phase: 'ended' }))
      }, { headers: { 'Cache-Control': 'no-store' } });
    }
    
    // Get current round (latest)
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
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
      console.log('Ending round...');
      // End the round
      const { error: updateError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ 
          phase: 'ended',
          ended_at: new Date().toISOString()
        })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error ending round:', updateError);
        return NextResponse.json({ error: 'Failed to end round' }, { status: 500 });
      }

      console.log(`Round ${round.id} ended successfully`);
    } else {
      console.log(`Round is not live (phase: ${round.phase}), not ending`);
    }

    // Always check scheduler after ending a round (regardless of phase)
    console.log('Checking scheduler after ending round...');
    const { data: schedulerData, error: schedulerError } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (schedulerError) {
      console.error('Error fetching scheduler config in round/end:', schedulerError);
    }

    if (!schedulerError && schedulerData?.value) {
      const schedulerConfig = schedulerData.value;
      console.log('Scheduler config found:', schedulerConfig);
      console.log('Scheduler enabled:', schedulerConfig.enabled);
      
      if (schedulerConfig.enabled) {
        // Set phase to 'winner_display' immediately
        const now = new Date();
        const updatedSchedulerConfig = {
          ...schedulerConfig,
          currentPhase: 'winner_display',
          nextGameStart: null // Clear next game start for now
        };

        console.log('Updating scheduler config to winner_display:', updatedSchedulerConfig);

        const { error: updateError } = await supabaseAdmin
          .from(tableNames.config)
          .upsert({ 
            key: 'scheduler', 
            value: updatedSchedulerConfig, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'key' });

        if (updateError) {
          console.error('Error updating scheduler config:', updateError);
        } else {
          console.log('Scheduler set to winner_display phase');
          
          // Automatically transition to setup phase after 3 seconds
          setTimeout(async () => {
            console.log('Auto-transitioning from winner_display to setup phase');
            
            const nextGameStart = new Date(Date.now() + (schedulerConfig.preBuyMinutes || 2) * 60 * 1000);
            const finalSchedulerConfig = {
              ...schedulerConfig,
              currentPhase: 'setup',
              nextGameStart: nextGameStart.toISOString()
            };

            await supabaseAdmin
              .from(tableNames.config)
              .upsert({ 
                key: 'scheduler', 
                value: finalSchedulerConfig, 
                updated_at: new Date().toISOString() 
              }, { onConflict: 'key' });

            console.log(`Auto-transitioned to setup phase. Next game scheduled for: ${nextGameStart.toISOString()}`);
          }, (schedulerConfig.winnerDisplaySeconds || 3) * 1000);
        }
      } else {
        console.log('Scheduler is disabled, not updating phase');
      }
    } else {
      console.log('No scheduler config found or error occurred');
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in end endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

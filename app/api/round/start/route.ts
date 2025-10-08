import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Start round endpoint called');

    // Try to get roundId from request body if provided
    let roundId = null;
    let isScheduledStart = false;
    try {
      const body = await req.json().catch(() => ({}));
      roundId = body.roundId;
      isScheduledStart = body.isScheduledStart || false;
    } catch {
      // No body or invalid JSON, continue without roundId
    }

    // Check if this is a scheduled start
    if (isScheduledStart) {
      console.log('Scheduled game start triggered');
      
      // Update scheduler to mark game as started
      const { data: schedulerData, error: schedulerError } = await supabaseAdmin
        .from(tableNames.config)
        .select('value')
        .eq('key', 'scheduler')
        .maybeSingle();

      if (!schedulerError && schedulerData?.value) {
        const schedulerConfig = schedulerData.value;
        if (schedulerConfig.enabled) {
          const updatedSchedulerConfig = {
            ...schedulerConfig,
            currentPhase: 'live',
            nextGameStart: null // Clear next game start since we're starting now
          };

          await supabaseAdmin
            .from(tableNames.config)
            .upsert({ 
              key: 'scheduler', 
              value: updatedSchedulerConfig, 
              updated_at: new Date().toISOString() 
            }, { onConflict: 'key' });
        }
      }
    }

    // Get current round
    const { data: currentRound, error: fetchError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    console.log('Current round data:', { currentRound, fetchError, requestedRoundId: roundId });

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current round:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current round' }, { status: 500 });
    }

    // If already live, return current state
    if (currentRound && currentRound.phase === 'live') {
      console.log('Round is already live, returning current state');
      return NextResponse.json(
        { 
          id: currentRound.id, 
          phase: 'live', 
          speed_ms: currentRound.speed_ms, 
          called: currentRound.called || [] 
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Get speed_ms from config
    let speedMs = 800; // default
    try {
      const { data: configData, error: configError } = await supabaseAdmin
        .from(tableNames.config)
        .select('value')
        .eq('key', 'round.duration_ms')
        .single();
      
      if (!configError && configData?.value) {
        // Handle both string and number values
        const value = typeof configData.value === 'string' ? configData.value : configData.value.toString();
        speedMs = parseInt(value) || 800;
        console.log('Using config speed_ms:', speedMs);
      } else {
        console.log('No config found, using default speed_ms:', speedMs);
      }
    } catch (error) {
      console.log('Could not fetch config, using default speed_ms:', error);
    }

    // Start new round - create new round if previous was ended, otherwise update
    const roundData = {
      phase: 'live',
      called: [],
      speed_ms: speedMs,
      prize_pool: currentRound?.prize_pool || 0,
      total_collected: currentRound?.total_collected || 0
    };

    console.log('Starting round with data:', roundData);

    let result;
    // If current round is ended or doesn't exist, create a new round
    if (!currentRound || currentRound.phase === 'ended') {
      console.log('Creating new round (previous round was ended or no round exists)');
      // Create new round
      const { data, error } = await supabaseAdmin
        .from(tableNames.rounds)
        .insert([roundData])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating round:', error);
        console.error('Create details:', { roundData, errorCode: error.code, errorMessage: error.message });
        return NextResponse.json({ error: `Failed to create round: ${error.message}`, details: error }, { status: 500 });
      }
      result = data;
      console.log('Round created successfully:', result);
    } else {
      console.log('Updating existing round:', currentRound.id);
      // Update existing round (only if it's in setup phase)
      const { data, error } = await supabaseAdmin
        .from(tableNames.rounds)
        .update(roundData)
        .eq('id', currentRound.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating round:', error);
        console.error('Update details:', { roundId: currentRound.id, roundData, errorCode: error.code, errorMessage: error.message });
        return NextResponse.json({ error: `Failed to update round: ${error.message}`, details: error }, { status: 500 });
      }
      result = data;
      console.log('Round updated successfully:', result);
    }

    return NextResponse.json(
      { 
        id: result.id, 
        phase: 'live', 
        speed_ms: result.speed_ms, 
        called: result.called || [] 
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Unexpected error in start round:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    console.log('Scheduler cycle endpoint called');
    
    // Get current scheduler config
    const { data: schedulerData, error: schedulerError } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (schedulerError) {
      console.error('Error fetching scheduler config:', schedulerError);
      return NextResponse.json({ error: 'Failed to fetch scheduler config' }, { status: 500 });
    }

    if (!schedulerData?.value || !schedulerData.value.enabled) {
      return NextResponse.json({ message: 'Scheduler not enabled' }, { status: 200 });
    }

    const schedulerConfig = schedulerData.value;
    const now = new Date();

    console.log('Current scheduler phase:', schedulerConfig.currentPhase);
    console.log('Scheduler enabled:', schedulerConfig.enabled);
    console.log('Current time:', now.toISOString());

    // Handle different phases of the game cycle
    // Note: winner_display to setup transition is now handled automatically by round/end endpoint
    
    // Check if scheduler is in 'live' phase but round has ended
    if (schedulerConfig.currentPhase === 'live') {
      // Get current round to check if it has ended
      const { data: roundData, error: roundError } = await supabaseAdmin
        .from(tableNames.rounds)
        .select('id, phase, ended_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!roundError && roundData && roundData.phase === 'ended') {
        // Round has ended, transition to winner_display phase
        console.log('Round has ended, transitioning from live to winner_display phase');
        
        const updatedSchedulerConfig = {
          ...schedulerConfig,
          currentPhase: 'winner_display',
          nextGameStart: null
        };

        await supabaseAdmin
          .from(tableNames.config)
          .upsert({ 
            key: 'scheduler', 
            value: updatedSchedulerConfig, 
            updated_at: new Date().toISOString() 
          }, { onConflict: 'key' });

        return NextResponse.json({ 
          message: 'Transitioned from live to winner_display phase',
          action: 'winner_display',
          newPhase: 'winner_display'
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }
    
    // Handle winner_display to setup transition
    if (schedulerConfig.currentPhase === 'winner_display') {
      // Check if enough time has passed for winner display
      const winnerDisplaySeconds = schedulerConfig.winnerDisplaySeconds || 5;
      
      // Get the round end time to calculate elapsed time
      const { data: roundData, error: roundError } = await supabaseAdmin
        .from(tableNames.rounds)
        .select('ended_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!roundError && roundData && roundData.ended_at) {
        const endedTime = new Date(roundData.ended_at);
        const elapsedSeconds = (now.getTime() - endedTime.getTime()) / 1000;
        
        if (elapsedSeconds >= winnerDisplaySeconds) {
          // Time to transition to setup phase
          console.log(`Winner display period (${winnerDisplaySeconds}s) has elapsed, transitioning to setup phase`);
          
          // Update scheduler config
          const nextGameStart = new Date(now.getTime() + (schedulerConfig.preBuyMinutes || 2) * 60 * 1000);
          const updatedSchedulerConfig = {
            ...schedulerConfig,
            currentPhase: 'setup',
            nextGameStart: nextGameStart.toISOString()
          };

          await supabaseAdmin
            .from(tableNames.config)
            .upsert({ 
              key: 'scheduler', 
              value: updatedSchedulerConfig, 
              updated_at: new Date().toISOString() 
            }, { onConflict: 'key' });

          // Also update the round phase to 'setup' so client can dismiss winner popup
          const { data: currentRound, error: roundUpdateError } = await supabaseAdmin
            .from(tableNames.rounds)
            .select('id')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!roundUpdateError && currentRound) {
            await supabaseAdmin
              .from(tableNames.rounds)
              .update({ 
                phase: 'setup',
                called: []  // Clear called numbers for the new round
              })
              .eq('id', currentRound.id);
            
            console.log(`Updated round ${currentRound.id} phase to 'setup' and cleared called numbers`);
          }

          return NextResponse.json({ 
            message: `Transitioned from winner_display to setup phase after ${elapsedSeconds.toFixed(1)}s`,
            action: 'setup',
            newPhase: 'setup',
            nextGameStart: nextGameStart.toISOString()
          }, { headers: { 'Cache-Control': 'no-store' } });
        } else {
          console.log(`Winner display still active: ${elapsedSeconds.toFixed(1)}s / ${winnerDisplaySeconds}s elapsed`);
        }
      }
    }
    
    if (schedulerConfig.currentPhase === 'setup') {
      // Check if it's time to start the next game
      if (schedulerConfig.nextGameStart) {
        const nextGameTime = new Date(schedulerConfig.nextGameStart);
        const timeDiff = nextGameTime.getTime() - now.getTime();
        
        if (timeDiff <= 0) {
          // Time to start the next game
          console.log('Starting next game from setup phase');
          
          // Start the round directly (avoid internal HTTP calls in production)
          console.log('Starting round directly from cycle endpoint...');
          try {
            // First check if there's already a live round
            const { data: liveRound, error: liveRoundError } = await supabaseAdmin
              .from(tableNames.rounds)
              .select('*')
              .eq('phase', 'live')
              .maybeSingle();

            if (liveRoundError && liveRoundError.code !== 'PGRST116') {
              console.error('Error checking for live round:', liveRoundError);
              return NextResponse.json({ error: 'Failed to check for live round' }, { status: 500 });
            }

            if (liveRound) {
              console.log('Live round already exists:', liveRound.id, 'skipping creation');
              return NextResponse.json({ 
                message: 'Live round already exists',
                roundId: liveRound.id 
              }, { headers: { 'Cache-Control': 'no-store' } });
            }

            // Get current round (latest)
            const { data: currentRound, error: roundError } = await supabaseAdmin
              .from(tableNames.rounds)
              .select('*')
              .order('created_at', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (roundError && roundError.code !== 'PGRST116') {
              console.error('Error fetching current round:', roundError);
              return NextResponse.json({ error: 'Failed to fetch current round' }, { status: 500 });
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
                speedMs = parseInt(configData.value) || 800;
              }
            } catch (error) {
              console.log('Could not fetch config, using default speed_ms:', error);
            }

            if (!currentRound || currentRound.phase === 'ended') {
              // Create a new round with fallback for missing columns
              const roundData: any = {
                phase: 'live',
                called: [],
                speed_ms: speedMs
              };
              
              // Only add pricing columns if they exist (for backward compatibility)
              if (currentRound?.prize_pool !== undefined) {
                roundData.prize_pool = currentRound.prize_pool || 0;
              }
              if (currentRound?.total_collected !== undefined) {
                roundData.total_collected = currentRound.total_collected || 0;
              }

              const { data: newRound, error: insertError } = await supabaseAdmin
                .from(tableNames.rounds)
                .insert([roundData])
                .select()
                .single();

              if (insertError) {
                console.error('Error creating new round:', insertError);
                return NextResponse.json({ error: `Failed to create new round: ${insertError.message}` }, { status: 500 });
              }
              console.log('New round created:', newRound.id);
            } else {
              // Update existing round
              const { error: updateError } = await supabaseAdmin
                .from(tableNames.rounds)
                .update({ 
                  phase: 'live',
                  called: [],
                  speed_ms: speedMs
                })
                .eq('id', currentRound.id);

              if (updateError) {
                console.error('Error updating round:', updateError);
                return NextResponse.json({ error: `Failed to update round: ${updateError.message}` }, { status: 500 });
              }
              console.log('Round updated to live:', currentRound.id);
            }

            console.log('Round started successfully via direct database call');
          } catch (dbError) {
            console.error('Error starting round directly:', dbError);
            return NextResponse.json({ error: 'Failed to start round' }, { status: 500 });
          }

          // Update scheduler to mark game as started
          const updatedSchedulerConfig = {
            ...schedulerConfig,
            currentPhase: 'live',
            nextGameStart: null
          };

          await supabaseAdmin
            .from(tableNames.config)
            .upsert({ 
              key: 'scheduler', 
              value: updatedSchedulerConfig, 
              updated_at: new Date().toISOString() 
            }, { onConflict: 'key' });

          return NextResponse.json({ 
            message: 'Game started from setup phase',
            action: 'started',
            newPhase: 'live'
          }, { headers: { 'Cache-Control': 'no-store' } });
        }
      }
    }

    return NextResponse.json({ 
      message: 'No action needed',
      action: 'none',
      currentPhase: schedulerConfig.currentPhase
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('Unexpected error in scheduler cycle endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

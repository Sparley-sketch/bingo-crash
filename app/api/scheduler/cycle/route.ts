import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

// Simple mutex to prevent duplicate round creation
let isCreatingRound = false;

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    
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

          // Create a NEW round instead of updating the existing one
          // Check mutex to prevent duplicate round creation
          if (isCreatingRound) {
            console.log('Round creation already in progress, skipping...');
            return NextResponse.json({ 
              message: 'Round creation already in progress',
              action: 'setup'
            }, { headers: { 'Cache-Control': 'no-store' } });
          }
          
          isCreatingRound = true;
          console.log('Creating NEW round for next game cycle');
          
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

          // Create new round with fresh prize pool
          const newRoundData = {
            phase: 'setup',
            called: [],
            speed_ms: speedMs,
            prize_pool: 0,  // Reset prize pool for new round
            total_collected: 0  // Reset total collected for new round
          };

          const { data: newRound, error: createError } = await supabaseAdmin
            .from(tableNames.rounds)
            .insert([newRoundData])
            .select()
            .single();

          if (createError) {
            console.error('Error creating new round:', createError);
            isCreatingRound = false; // Release mutex on error
          } else {
            console.log(`Created NEW round ${newRound.id} with fresh prize pool`);
            isCreatingRound = false; // Release mutex on success
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

            // Always create a new round if the current round has ended
            if (!currentRound || currentRound.phase === 'ended') {
              // Create a new round in setup phase first (not live)
              const roundData: any = {
                phase: 'setup',  // Start in setup phase to allow card purchases
                called: [],
                speed_ms: speedMs
              };
              
              // Reset prize pool and total collected for new round
              roundData.prize_pool = 0;
              roundData.total_collected = 0;

              console.log('Creating new round with data:', roundData);

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
              console.log('New round data:', {
                id: newRound.id,
                phase: newRound.phase,
                prize_pool: newRound.prize_pool,
                total_collected: newRound.total_collected
              });
            } else {
              // Update existing round (preserve prize pool built during setup)
              const { error: updateError } = await supabaseAdmin
                .from(tableNames.rounds)
                .update({ 
                  phase: 'live',
                  called: [],
                  speed_ms: speedMs
                  // Don't reset prize_pool and total_collected - preserve what was built during setup
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

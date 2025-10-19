import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const schedulerStartTime = Date.now();
  const schedulerTimestamp = new Date().toISOString();
  
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    
    console.log(`🔄 SCHEDULER AUTO-START CALLED:`);
    console.log(`  📅 Timestamp: ${schedulerTimestamp}`);
    console.log(`  ⏰ Start Time: ${schedulerStartTime}ms`);
    
    // Check if it's time to start a game
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
      console.log('Scheduler not enabled or no config found');
      return NextResponse.json({ message: 'Scheduler not enabled' }, { status: 200 });
    }

    const schedulerConfig = schedulerData.value;
    const now = new Date();

    console.log('Scheduler config:', {
      enabled: schedulerConfig.enabled,
      nextGameStart: schedulerConfig.nextGameStart,
      currentPhase: schedulerConfig.currentPhase
    });

    // Check if it's time to start the game
    if (schedulerConfig.nextGameStart) {
      const nextGameTime = new Date(schedulerConfig.nextGameStart);
      const timeDiff = nextGameTime.getTime() - now.getTime();
      
      console.log('Time check:', {
        nextGameTime: nextGameTime.toISOString(),
        now: now.toISOString(),
        timeDiff: timeDiff,
        shouldStart: timeDiff <= 0
      });
      
      if (timeDiff <= 0) {
        // Time to start the game!
        console.log('Auto-starting game via scheduler - time reached!');
        
        // Start the round directly (avoid internal HTTP calls in production)
          console.log('Starting round directly...');
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
              console.log('Live round already exists:', liveRound.id, 'checking if it should be ended');
              // Don't return early - let the logic check if this round should be ended
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

            console.log('Scheduler auto-start - Current round check:', {
              hasCurrentRound: !!currentRound,
              currentRoundId: currentRound?.id,
              currentPhase: currentRound?.phase,
              willCreateNew: !currentRound || currentRound.phase === 'ended'
            });

            // If current round is live, end it first before creating new round
            if (currentRound && currentRound.phase === 'live') {
              console.log('Ending current live round before creating new round');
              await supabaseAdmin
                .from(tableNames.rounds)
                .update({ 
                  phase: 'ended',
                  ended_at: new Date().toISOString()
                })
                .eq('id', currentRound.id);
            }

            // Always create a new round if the current round has ended
            if (!currentRound || currentRound.phase === 'ended') {
              console.log('Creating NEW round (previous round ended or no round exists)');
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
            } else if (currentRound.phase === 'setup') {
              console.log('UPDATING existing round from setup to live (preserve prize pool built during setup)');
              // Update existing round from setup to live (preserve prize pool built during setup)
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
            } else {
              console.log('Current round is in phase:', currentRound.phase, '- no action needed');
            }

          // Update scheduler config to mark game as started
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

          console.log('Scheduler updated to live phase');
        } catch (dbError) {
          console.error('Error starting round directly:', dbError);
          return NextResponse.json({ error: 'Failed to start round' }, { status: 500 });
        }

        return NextResponse.json({ 
          message: 'Game started automatically',
          started: true 
        }, { headers: { 'Cache-Control': 'no-store' } });
      }
    }

    return NextResponse.json({ 
      message: 'Not time to start yet',
      started: false,
      timeUntilStart: schedulerConfig.nextGameStart ? new Date(schedulerConfig.nextGameStart).getTime() - now.getTime() : null,
      debug: {
        nextGameStart: schedulerConfig.nextGameStart,
        now: now.toISOString(),
        timeDiff: schedulerConfig.nextGameStart ? new Date(schedulerConfig.nextGameStart).getTime() - now.getTime() : null
      }
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in auto-start endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

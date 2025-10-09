import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Auto-start endpoint called');
    
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
          // Get current round
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

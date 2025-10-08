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
        
        // Instead of complex database operations, just call the existing start round API
        console.log('Calling start round API...');
        try {
          const startResponse = await fetch(`http://localhost:3000/api/round/start`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ isScheduledStart: true })
          });

          if (!startResponse.ok) {
            const errorText = await startResponse.text();
            console.error('Failed to start round:', startResponse.status, errorText);
            return NextResponse.json({ error: `Failed to start round: ${errorText}` }, { status: 500 });
          }

          const startResult = await startResponse.json();
          console.log('Round started successfully:', startResult);
        } catch (fetchError) {
          console.error('Error calling start round API:', fetchError);
          return NextResponse.json({ error: 'Failed to call start round API' }, { status: 500 });
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

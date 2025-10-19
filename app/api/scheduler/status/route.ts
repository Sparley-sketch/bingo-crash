import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    // Get scheduler configuration
    const { data: schedulerData, error: schedulerError } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (schedulerError) {
      console.error('Error fetching scheduler config:', schedulerError);
      return NextResponse.json({ error: 'Failed to fetch scheduler config' }, { status: 500 });
    }

    const schedulerConfig = schedulerData?.value || {
      enabled: false,
      preBuyMinutes: 2,
      nextGameStart: null,
      currentPhase: 'setup',
      winnerDisplaySeconds: 1,
      purchaseBlockSeconds: 5
    };

    // If scheduler is disabled, return disabled status
    if (!schedulerConfig.enabled) {
      return NextResponse.json({
        enabled: false,
        timeUntilNextGame: null,
        canPurchaseCards: true,
        currentPhase: 'manual',
        nextGameStart: null
      }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // Get current round state
    const { data: roundData, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id, phase, ended_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (roundError) {
      console.error('Error fetching round data:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round data' }, { status: 500 });
    }

    const now = new Date();
    let timeUntilNextGame = null;
    let canPurchaseCards = true;
    let currentPhase = schedulerConfig.currentPhase || 'setup'; // Use scheduler config phase as primary
    let nextGameStart = schedulerConfig.nextGameStart;

    // Calculate time until next game
    if (schedulerConfig.nextGameStart) {
      const nextGameTime = new Date(schedulerConfig.nextGameStart);
      const timeDiff = nextGameTime.getTime() - now.getTime();
      
      if (timeDiff > 0) {
        timeUntilNextGame = Math.floor(timeDiff / 1000); // seconds
        
        // Block purchases in last 5 seconds
        if (timeUntilNextGame <= schedulerConfig.purchaseBlockSeconds) {
          canPurchaseCards = false;
        }
        
        // Phase is determined by scheduler config, not round state
      } else {
        // Time for next game has passed, start the game
        timeUntilNextGame = 0;
        currentPhase = 'starting';
      }
    }

    return NextResponse.json({
      enabled: true,
      timeUntilNextGame,
      canPurchaseCards,
      currentPhase,
      nextGameStart: schedulerConfig.nextGameStart,
      preBuyMinutes: schedulerConfig.preBuyMinutes,
      winnerDisplaySeconds: schedulerConfig.winnerDisplaySeconds,
      purchaseBlockSeconds: schedulerConfig.purchaseBlockSeconds
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in scheduler status endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

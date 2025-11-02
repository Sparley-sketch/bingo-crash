import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { GAME_TYPES, GAME_TYPE_VALIDATION } from '@/lib/gameConstants';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    
    const body = await req.json().catch(() => ({}));
    const { action, preBuyMinutes, winnerDisplaySeconds, gameType } = body;

    if (!action || !['start', 'stop', 'reschedule', 'switch_game'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action. Must be start, stop, reschedule, or switch_game' }, { status: 400 });
    }

    // Validate game type if provided
    if (gameType && !Object.values(GAME_TYPES).includes(gameType)) {
      return NextResponse.json({ error: 'Invalid game type' }, { status: 400 });
    }

    // Get current scheduler config
    const { data: currentData, error: fetchError } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching scheduler config:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch scheduler config' }, { status: 500 });
    }

    const currentConfig = currentData?.value || {
      enabled: false,
      preBuyMinutes: 2,
      nextGameStart: null,
      currentPhase: 'setup',
      winnerDisplaySeconds: 1,
      purchaseBlockSeconds: 5,
      currentGame: GAME_TYPES.BINGO_CRASH,
      gameRotation: false,
      rotationInterval: 60 // minutes
    };

    let updatedConfig = { ...currentConfig };

    if (action === 'start') {
      // Start scheduler - set next game time
      const now = new Date();
      const nextGameTime = new Date(now.getTime() + (preBuyMinutes || currentConfig.preBuyMinutes) * 60 * 1000);
      
      updatedConfig = {
        ...currentConfig,
        enabled: true,
        preBuyMinutes: preBuyMinutes || currentConfig.preBuyMinutes,
        winnerDisplaySeconds: winnerDisplaySeconds !== undefined ? winnerDisplaySeconds : currentConfig.winnerDisplaySeconds,
        nextGameStart: nextGameTime.toISOString(),
        currentPhase: 'setup',
        currentGame: currentConfig.currentGame // Preserve the current game selection
      };
      
      console.log(`🎮 Starting scheduler for game: ${currentConfig.currentGame}`);
    } else if (action === 'stop') {
      // Stop scheduler
      updatedConfig = {
        ...currentConfig,
        enabled: false,
        nextGameStart: null,
        currentPhase: 'manual'
      };
    } else if (action === 'reschedule') {
      // Reschedule next game
      if (!currentConfig.enabled) {
        return NextResponse.json({ error: 'Scheduler is not enabled' }, { status: 400 });
      }
      
      const now = new Date();
      const nextGameTime = new Date(now.getTime() + (preBuyMinutes || currentConfig.preBuyMinutes) * 60 * 1000);
      
      updatedConfig = {
        ...currentConfig,
        preBuyMinutes: preBuyMinutes || currentConfig.preBuyMinutes,
        nextGameStart: nextGameTime.toISOString(),
        currentPhase: 'setup'
      };
    } else if (action === 'switch_game') {
      // Switch to a different game
      if (!gameType) {
        return NextResponse.json({ error: 'Game type is required for switch_game action' }, { status: 400 });
      }
      
      updatedConfig = {
        ...currentConfig,
        currentGame: gameType,
        currentPhase: 'setup',
        nextGameStart: null // Reset next game start when switching
      };
      
      console.log(`🎮 Switching to game: ${gameType}`);
    }

    // Save updated config
    const { error: saveError } = await supabaseAdmin
      .from(tableNames.config)
      .upsert({ 
        key: 'scheduler', 
        value: updatedConfig, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });

    if (saveError) {
      console.error('Error saving scheduler config:', saveError);
      return NextResponse.json({ error: 'Failed to save scheduler config' }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      config: updatedConfig
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in scheduler control endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
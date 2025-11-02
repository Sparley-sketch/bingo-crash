import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { verifyAdminAuth } from '@/lib/adminAuth';
import { unifiedRNG } from '@/lib/unifiedRNG';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    
    console.log('🚀 Start round endpoint called - Manual start from admin');

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

    // Determine current game from scheduler (for game_type)
    let currentGame: string = 'bingo_crash';
    try {
      const { data: sched, error: schedErr } = await supabaseAdmin
        .from(tableNames.config)
        .select('value')
        .eq('key', 'scheduler')
        .maybeSingle();
      if (!schedErr && sched?.value?.currentGame) currentGame = sched.value.currentGame;
    } catch {}

    // Get current round
    const { data: currentRound, error: fetchError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .eq('game_type', currentGame)
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

    let result;
    // If current round is ended or doesn't exist, create a new round
    if (!currentRound || currentRound.phase === 'ended') {
      console.log('Creating new round (previous round was ended or no round exists)');
      // Create new round - reset prize pool for truly new rounds
      const newRoundData = {
        phase: 'live',
        called: [],
        speed_ms: speedMs,
        prize_pool: 0,  // Reset prize pool for new round
        total_collected: 0,  // Reset total collected for new round
        game_type: currentGame
      };
      
      const { data, error } = await supabaseAdmin
        .from(tableNames.rounds)
        .insert([newRoundData])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating round:', error);
        console.error('Create details:', { newRoundData, errorCode: error.code, errorMessage: error.message });
        return NextResponse.json({ error: `Failed to create round: ${error.message}`, details: error }, { status: 500 });
      }
      result = data;
      console.log('Round created successfully:', result);
    } else {
      console.log('Updating existing round:', currentRound.id);
      // Update existing round (preserve prize pool built during setup)
      const updateData = {
        phase: 'live',
        called: [],
        speed_ms: speedMs,
        game_type: currentGame
        // Don't reset prize_pool and total_collected - preserve what was built during setup
      };
      
      const { data, error } = await supabaseAdmin
        .from(tableNames.rounds)
        .update(updateData)
        .eq('id', currentRound.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating round:', error);
        console.error('Update details:', { roundId: currentRound.id, updateData, errorCode: error.code, errorMessage: error.message });
        return NextResponse.json({ error: `Failed to update round: ${error.message}`, details: error }, { status: 500 });
      }
      result = data;
      console.log('Round updated successfully:', result);
    }

    // If Scramblingo, precompute draw order and winner before play
    try {
      if (currentGame === 'scramblingo') {
        // Ensure RNG initialized
        await unifiedRNG.initialize().catch(()=>{});
        // Build shuffled 1..52 draw order (no sort)
        const ballCount = 52;
        const nums = Array.from({ length: ballCount }, (_, i) => i + 1);
        for (let i = nums.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [nums[i], nums[j]] = [nums[j], nums[i]];
        }

        // Load purchased Scramblingo cards for this round
        const { data: cards, error: cardsErr } = await supabaseAdmin
          .from(tableNames.cards)
          .select('id, numbers, player_alias, completed, purchased')
          .eq('round_id', result.id)
          .eq('game_type', 'scramblingo');
        if (cardsErr) {
          console.error('Failed loading Scramblingo cards for precompute:', cardsErr);
        }

        // Compute earliest completion index for each card (needs 6 matches)
        let winnerIndex: number | null = null;
        const winnerAliases: Set<string> = new Set();
        (cards || []).forEach((c: any) => {
          const target = new Set<number>(c?.numbers || []);
          let matches = 0;
          for (let idx = 0; idx < nums.length; idx++) {
            if (target.has(nums[idx])) {
              matches++;
              if (matches >= 6) {
                // Store as 1-based call count (so end happens after the Nth call)
                const oneBased = idx + 1;
                if (winnerIndex === null || oneBased < winnerIndex) {
                  winnerIndex = oneBased;
                  winnerAliases.clear();
                  if (c?.player_alias) winnerAliases.add(c.player_alias);
                } else if (winnerIndex === oneBased && c?.player_alias) {
                  winnerAliases.add(c.player_alias);
                }
                break;
              }
            }
          }
        });

        await supabaseAdmin
          .from(tableNames.rounds)
          .update({
            draw_order: nums,
            winner_call_index: winnerIndex,
            winner_alias: winnerIndex !== null ? Array.from(winnerAliases).join(',') : null
          })
          .eq('id', result.id);
      }
    } catch (e) {
      console.error('Precompute draw order failed:', e);
    }

    // Check if there are any players/cards after starting the game
    // If no live cards or 0 players exist, immediately reset to setup mode and reschedule
    console.log(`🔍 Checking for live cards in round: ${result.id}`);
    console.log(`🔍 Using cards table: ${tableNames.cards}`);
    
    const { count: liveCardsCount, error: liveCardsError } = await supabaseAdmin
      .from(tableNames.cards)
      .select('*', { count: 'exact', head: true })
      .eq('round_id', result.id)
      .eq('exploded', false)
      .eq('paused', false);

    console.log(`🔍 Live cards query result:`, { liveCardsCount, liveCardsError });
    const finalLiveCardsCount = liveCardsCount || 0;
    console.log(`🔍 Live cards check after game start: ${finalLiveCardsCount} cards found`);

    // Also count distinct players who purchased cards for this round (Scramblingo + Bingo)
    let purchasedPlayers = 0;
    try {
      const { data: playersRows } = await supabaseAdmin
        .from(tableNames.cards)
        .select('player_alias')
        .eq('round_id', result.id);
      if (playersRows && Array.isArray(playersRows)) {
        const distinct = new Set((playersRows as any[]).map(r => r.player_alias).filter(Boolean));
        purchasedPlayers = distinct.size;
      }
    } catch (e) {
      console.warn('⚠️ Player count check failed:', e);
    }
    console.log(`🔍 Player count after game start: ${purchasedPlayers}`);

    // If no live cards exist when game starts, reset to setup mode
    if (finalLiveCardsCount === 0 || purchasedPlayers === 0) {
      console.log('⚠️  No live cards found when game started - resetting to setup mode');
      
      const { error: resetError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ 
          phase: 'setup',
          called: [],
          ended_at: null,
          winner_alias: null,
          winner_daubs: null
        })
        .eq('id', result.id);

      if (resetError) {
        console.error('Error resetting round to setup:', resetError);
        return NextResponse.json({ error: `Failed to reset round: ${resetError.message}` }, { status: 500 });
      }

      console.log('✅ Round reset to setup mode due to no live cards');
      
      // If scheduler is enabled, also reset the scheduler with new countdown
      if (isScheduledStart) {
        try {
          const { data: schedulerData, error: schedulerError } = await supabaseAdmin
            .from(tableNames.config)
            .select('value')
            .eq('key', 'scheduler')
            .maybeSingle();

          if (!schedulerError && schedulerData?.value) {
            const schedulerConfig = schedulerData.value;
            if (schedulerConfig.enabled) {
              // Calculate new game start time based on pre-buy period
              const preBuyMinutes = schedulerConfig.preBuyMinutes || 2;
              const newGameStartTime = new Date();
              newGameStartTime.setMinutes(newGameStartTime.getMinutes() + preBuyMinutes);
              
              console.log(`🔄 Scheduler reset - new game will start in ${preBuyMinutes} minutes at ${newGameStartTime.toISOString()}`);
              
              // Update scheduler config back to setup phase with new start time
              const resetSchedulerConfig = {
                ...schedulerConfig,
                currentPhase: 'setup',
                nextGameStart: newGameStartTime.toISOString()
              };

              await supabaseAdmin
                .from(tableNames.config)
                .upsert({ 
                  key: 'scheduler', 
                  value: resetSchedulerConfig, 
                  updated_at: new Date().toISOString() 
                }, { onConflict: 'key' });
            }
          }
        } catch (error) {
          console.error('Error updating scheduler after reset:', error);
          // Don't fail the request, just log the error
        }
      }
      
      return NextResponse.json(
        { 
          id: result.id, 
          phase: 'setup', 
          speed_ms: result.speed_ms, 
          called: [],
          message: 'Game reset to setup mode - no live cards found',
          schedulerReset: isScheduledStart
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
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

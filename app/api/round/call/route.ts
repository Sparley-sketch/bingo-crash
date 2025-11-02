import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { getCertifiedRandom } from '@/lib/certifiedRNG';
import { isDev } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const callStartTime = Date.now();
  const callTimestamp = new Date().toISOString();
  
  try {
    // Note: This endpoint is called by the game client during gameplay, not admin users
    // Determine current game from scheduler so we operate on the correct game type
    let currentGame: string = 'bingo_crash';
    try {
      const { data: sched, error: schedErr } = await supabaseAdmin
        .from(tableNames.config)
        .select('value')
        .eq('key', 'scheduler')
        .maybeSingle();
      if (!schedErr && sched?.value?.currentGame) currentGame = sched.value.currentGame;
    } catch {}

    // Get latest round for current game
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id, phase, called, speed_ms, prize_pool, game_type, draw_order, winner_call_index, winner_alias')
      .eq('game_type', currentGame)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    // Stop accepting calls if game is not live
    if (round.phase !== 'live') {
      return NextResponse.json({ error: 'Game not live' }, { status: 409 });
    }

    // Determine game ball range
    const isScramblingo = (round as any).game_type === 'scramblingo';
    const maxBall = isScramblingo ? 52 : 25;
    let n: number;
    try {
      const body = await req.json();
      n = body.n;
    } catch {
      // No body: use deterministic draw order if present
      const order: number[] = (round as any).draw_order || [];
      const calledLen = (round.called || []).length;
      if (order.length > calledLen) {
        n = order[calledLen];
      } else {
        n = getCertifiedRandom(1, maxBall);
      }
    }

    // For Scramblingo always force deterministic value from draw_order
    if (isScramblingo) {
      const order: number[] = (round as any).draw_order || [];
      const calledLen = (round.called || []).length;
      if (order.length > calledLen) {
        n = order[calledLen];
      } else if (typeof n !== 'number' || n < 1 || n > maxBall) {
        n = getCertifiedRandom(1, maxBall);
      }
    } else if (typeof n !== 'number' || n < 1 || n > maxBall) {
      n = getCertifiedRandom(1, maxBall);
    }

    const calledNumbers = round.called || [];
    
    if (!calledNumbers.includes(n)) {
      const newCalledNumbers = [...calledNumbers, n];
      
            // Update the round with the new called number - optimized update
            const { error: updateError } = await supabaseAdmin
              .from(tableNames.rounds)
              .update({ called: newCalledNumbers })
              .eq('id', round.id)
              .select('id')
              .single();

      if (updateError) {
        console.error('Error updating called numbers:', updateError);
        return NextResponse.json({ error: 'Failed to update called numbers' }, { status: 500 });
      }

      // Apply the call to all cards (this would need to be implemented based on your card logic)
      // For now, we'll just update the called numbers
      
      const callEndTime = Date.now();
      const totalCallTime = callEndTime - callStartTime;
      const currentCallNumber = newCalledNumbers.length;
      
      console.log(`🎯 BALL CALL TIMING DETAILS:`);
      console.log(`  📅 Timestamp: ${callTimestamp}`);
      console.log(`  ⏰ Start Time: ${callStartTime}ms`);
      console.log(`  ⏰ End Time: ${callEndTime}ms`);
      console.log(`  ⏱️  Total Call Time: ${totalCallTime}ms`);
      console.log(`  🔢 Called Number: ${n}`);
      console.log(`  📊 Current Call #: ${currentCallNumber}/${maxBall}`);
      console.log(`  🎲 All Called Numbers: [${newCalledNumbers.join(', ')}]`);
      
      // Log timing performance
      if (totalCallTime > 100) {
        console.warn(`⚠️  SLOW BALL CALL: ${totalCallTime}ms (number ${n})`);
      } else if (totalCallTime < 50) {
        console.log(`✅ FAST BALL CALL: ${totalCallTime}ms (number ${n})`);
      } else {
        console.log(`⚡ NORMAL BALL CALL: ${totalCallTime}ms (number ${n})`);
      }
    }

    // If we reached/passed the precomputed winner index, end the round now
    const winnerIndex = (round as any).winner_call_index;
    if (typeof winnerIndex === 'number') {
      const curLen = calledNumbers.includes(n) ? calledNumbers.length : calledNumbers.length + 1;
      // Treat winner_call_index as the 1-based count to end on
      if (curLen >= winnerIndex) {
        await supabaseAdmin
          .from(tableNames.rounds)
          .update({ phase: 'ended', ended_at: new Date().toISOString() })
          .eq('id', (round as any).id);

        // Ensure winners are persisted (mark completed cards and set winner_alias)
        try {
          const effectiveCalled: number[] = (calledNumbers.includes(n) ? calledNumbers : [...calledNumbers, n]).map(Number);
          // Find all cards whose numbers are fully contained in the called set
          const { data: winCards } = await supabaseAdmin
            .from(tableNames.cards)
            .select('id, player_alias')
            .eq('round_id', (round as any).id)
            .eq('game_type', 'scramblingo')
            .containedBy('numbers', effectiveCalled as any);

          if (Array.isArray(winCards) && winCards.length > 0) {
            const cardIds = winCards.map((c: any) => c.id);
            await supabaseAdmin
              .from(tableNames.cards)
              .update({ completed: true })
              .in('id', cardIds);

            const aliases = Array.from(new Set(winCards.map((c: any) => c.player_alias).filter(Boolean)));
            await supabaseAdmin
              .from(tableNames.rounds)
              .update({ winner_alias: aliases.join(',') })
              .eq('id', (round as any).id);
          }
        } catch (e) {
          console.warn('⚠️ Failed to persist winners on end:', e);
        }

        // Signal winner_display in scheduler so clients can show popup; actual
        // transition to setup happens on explicit /api/round/transition from client.
        try {
          const { data: schedRow } = await supabaseAdmin
            .from(tableNames.config)
            .select('value')
            .eq('key', 'scheduler')
            .maybeSingle();
          if (schedRow?.value) {
            const cfg = schedRow.value;
            const updated = { ...cfg, currentPhase: 'winner_display', nextGameStart: null, winnerDisplayAt: new Date().toISOString(), winnerDisplaySeconds: cfg.winnerDisplaySeconds || 20 };
            await supabaseAdmin
              .from(tableNames.config)
              .upsert({ key: 'scheduler', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });
          }
        } catch (e) {
          console.error('Failed updating scheduler after end:', e);
        }

        // Do not create a new setup round immediately; keep 'ended' visible
        // so clients can display the winners popup reliably.

        // Credit prize pool proportionally by number of winning cards per player
        try {
          // Get card price
          const { data: priceRow } = await supabaseAdmin
            .from(tableNames.config)
            .select('value')
            .eq('key', 'card_price')
            .maybeSingle();
          const cardPrice = Number(priceRow?.value || 0);

          // All purchased cards for this round (bets)
          const { data: purchasedCards } = await supabaseAdmin
            .from(tableNames.cards)
            .select('player_alias')
            .eq('round_id', (round as any).id)
            .eq('game_type', 'scramblingo')
            .eq('purchased', true);
          const totalBets = (purchasedCards?.length || 0) * cardPrice;
          const pot = Math.floor(totalBets * 0.65);

          // Winning cards (completed=true)
          const { data: winningCards } = await supabaseAdmin
            .from(tableNames.cards)
            .select('player_alias')
            .eq('round_id', (round as any).id)
            .eq('game_type', 'scramblingo')
            .eq('completed', true);
          const winCounts = new Map<string, number>();
          (winningCards || []).forEach((c: any) => {
            if (!c?.player_alias) return;
            winCounts.set(c.player_alias, (winCounts.get(c.player_alias) || 0) + 1);
          });
          let totalWinningCards = Array.from(winCounts.values()).reduce((a, b) => a + b, 0);

          // Fallback: if no completed cards were persisted yet, split equally by precomputed aliases
          if (totalWinningCards === 0) {
            const aliasStr = (round as any).winner_alias || '';
            const aliases: string[] = aliasStr.split(',').map((s: string) => s.trim()).filter((s: string): s is string => Boolean(s));
            aliases.forEach((a: string) => winCounts.set(a, 1));
            totalWinningCards = aliases.length;
          }

          if (pot > 0 && totalWinningCards > 0) {
            const walletTable = isDev ? 'global_players_dev' : 'global_players';
            // Calculate base shares and remainder
            const payouts: Array<{ alias: string; amount: number }> = [];
            let distributed = 0;
            for (const [alias, cnt] of winCounts.entries()) {
              const amount = Math.floor((pot * cnt) / totalWinningCards);
              distributed += amount;
              payouts.push({ alias, amount });
            }
            let remainder = pot - distributed;
            // Distribute remainder to top winners deterministically
            for (let i = 0; i < payouts.length && remainder > 0; i++) {
              payouts[i].amount += 1;
              remainder -= 1;
            }

            // Apply payouts
            for (const { alias, amount } of payouts) {
              if (amount <= 0) continue;
              const { data: row } = await supabaseAdmin
                .from(walletTable)
                .select('wallet_balance')
                .eq('alias', alias)
                .maybeSingle();
              if (!row) {
                // Create wallet row for alias, then set starting balance to payout amount
                await supabaseAdmin
                  .from(walletTable)
                  .insert({ alias, wallet_balance: amount });
              } else {
                const current = Number(row.wallet_balance || 0);
                await supabaseAdmin
                  .from(walletTable)
                  .update({ wallet_balance: current + amount })
                  .eq('alias', alias);
              }
            }

            // Store pot on round so popup can show it
            await supabaseAdmin
              .from(tableNames.rounds)
              .update({ prize_pool: pot })
              .eq('id', (round as any).id);
          }
          else {
            // Still record pot for UI visibility even if no payouts
            await supabaseAdmin
              .from(tableNames.rounds)
              .update({ prize_pool: pot })
              .eq('id', (round as any).id);
          }
        } catch (e) {
          console.error('Prize crediting failed (non-fatal):', e);
        }
      }
    }

    const finalCallTime = Date.now() - callStartTime;
    console.log(`🏁 FINAL API RESPONSE TIME: ${finalCallTime}ms for ball ${n}`);

    return NextResponse.json({ 
      ok: true, 
      called: (round.called || []).length + 1, 
      number: n,
      timing: {
        callStartTime,
        callEndTime: Date.now(),
        totalTime: finalCallTime,
        timestamp: callTimestamp
      }
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in call endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

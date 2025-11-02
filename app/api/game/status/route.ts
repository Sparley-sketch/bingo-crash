import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames, isDev } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Explicit type for winner object to avoid null-only inference
type Winner = { alias: string; daubs: number } | null;
type SchedulerStatus = {
  enabled: boolean;
  timeUntilNextGame: number | null;
  canPurchaseCards: boolean;
  currentPhase: string;
  nextGameStart: string | null;
  preBuyMinutes: number;
  winnerDisplaySeconds: number;
  purchaseBlockSeconds: number;
  currentGame: string;
};
type WalletInfo = { balance: number | null; hasPlayer: boolean };

// Simple in-memory cache for game status (short-lived)
let lastGameStatus: any = null;
let lastCacheTime = 0;
const CACHE_DURATION = 25 // 100ms cache for merged endpoint

export async function GET(req: Request) {
  const startTime = Date.now();
  const now = Date.now();
  
  // Return cached response if available and recent
  if (lastGameStatus && (now - lastCacheTime) < CACHE_DURATION) {
    const responseTime = Date.now() - startTime;
    if (responseTime > 50) {
      console.warn(`⚠️  SLOW CACHED GAME STATUS: ${responseTime}ms`);
    }
    return NextResponse.json(lastGameStatus, { headers: { 'Cache-Control': 'no-store' }});
  }
  
  try {
    const { searchParams } = new URL(req.url);
    const alias = searchParams.get('alias');
    
    // Get core data in parallel (always needed)
    const [
      roundResult,
      schedulerResult,
      pricingResult
    ] = await Promise.allSettled([
      // 1. Get current round state
      supabaseAdmin
        .from(tableNames.rounds)
        .select('id, phase, called, speed_ms, prize_pool, winner_alias, winner_daubs, draw_order, winner_call_index')
        .order('created_at', { ascending: false })
        .limit(1)
        .single(),
      
      // 2. Get scheduler configuration
      supabaseAdmin
        .from(tableNames.config)
        .select('value')
        .eq('key', 'scheduler')
        .maybeSingle(),
      
      // 3. Get pricing configuration
      supabaseAdmin
        .from(tableNames.config)
        .select('key, value')
        .in('key', ['card_price', 'shield_price_percent'])
    ]);

    // Get wallet balance only when needed (setup phase, buy action, or winner)
    // This optimization reduces database calls from every ms to only when necessary
    let walletResult: { status: 'fulfilled' | 'rejected'; value?: any; reason?: any } = { 
      status: 'fulfilled', 
      value: { data: null, error: null } 
    };
    
    if (alias) {
      const round = roundResult.status === 'fulfilled' && !roundResult.value.error ? roundResult.value.data : null;
      const winnerMatch = (() => {
        if (!round?.winner_alias) return false;
        if (round.winner_alias === alias) return true;
        // Handle comma-separated multi-winner aliases
        try {
          const tokens = String(round.winner_alias).split(',').map((s) => s.trim());
          return tokens.includes(alias);
        } catch {
          return false;
        }
      })();
      const shouldLoadWallet = round && (
        round.phase === 'setup' || 
        winnerMatch ||
        // Add buy action detection here if needed
        false
      );
      
      if (shouldLoadWallet) {
        try {
          const { data, error } = await supabaseAdmin
            .from(isDev ? 'global_players_dev' : 'global_players')
            .select('wallet_balance')
            .eq('alias', alias)
            .maybeSingle();
            
          walletResult = {
            status: 'fulfilled' as const,
            value: { data, error }
          };
        } catch (error) {
          walletResult = {
            status: 'rejected' as const,
            reason: error
          };
        }
      }
    }

    // Process round state
    let roundState: {
      id: string | null;
      phase: 'setup' | 'live' | 'ended' | string;
      called: number[];
      speed_ms: number;
      live_cards_count: number;
      player_count: number;
      prize_pool: number;
      winner: Winner;
    } = {
      id: null,
      phase: 'setup',
      called: [],
      speed_ms: 800,
      live_cards_count: 0,
      player_count: 0,
      prize_pool: 0,
      winner: null
    };

    if (roundResult.status === 'fulfilled' && !roundResult.value.error) {
      const round = roundResult.value.data;
      if (round) {
        // Get live cards count and player count if needed
        let liveCardsCount = 0;
        let playerCount = 0;
        
        if (round.phase === 'live' || round.phase === 'ended') {
          const [liveCardsResult, playersResult] = await Promise.all([
            supabaseAdmin
              .from(tableNames.cards)
              .select('id', { count: 'exact', head: true })
              .eq('round_id', round.id)
              .eq('exploded', false)
              .eq('paused', false),
            supabaseAdmin
              .from(tableNames.cards)
              .select('player_alias', { count: 'exact', head: true })
              .eq('round_id', round.id)
          ]);

          liveCardsCount = liveCardsResult.count || 0;
          playerCount = playersResult.count || 0;
        }

        roundState = {
          id: round.id,
          phase: round.phase,
          called: round.called || [],
          speed_ms: round.speed_ms || 800,
          live_cards_count: liveCardsCount,
          player_count: playerCount,
          prize_pool: Number(round.prize_pool || 0),
          winner: round.winner_alias ? {
            alias: round.winner_alias,
            daubs: round.winner_daubs || 0
          } : null
        };

        // (pot computation moved below after pricing & scheduler are defined)
      }
    }

    // Process scheduler status
    let schedulerStatus: SchedulerStatus = {
      enabled: false,
      timeUntilNextGame: null,
      canPurchaseCards: true,
      currentPhase: 'manual',
      nextGameStart: null,
      preBuyMinutes: 2,
      winnerDisplaySeconds: 1,
      purchaseBlockSeconds: 5,
      currentGame: 'bingo_crash'
    };

    if (schedulerResult.status === 'fulfilled' && !schedulerResult.value.error) {
      const schedulerData = schedulerResult.value.data;
      const schedulerConfig = schedulerData?.value || {
        enabled: false,
        preBuyMinutes: 2,
        nextGameStart: null,
        currentPhase: 'setup',
        winnerDisplaySeconds: 1,
        purchaseBlockSeconds: 5,
        currentGame: 'bingo_crash'
      };

      // Always set the currentGame from config, regardless of scheduler enabled state
      console.log('🎮 Game Status API - Scheduler config:', schedulerConfig);
      console.log('🎮 Game Status API - Setting currentGame to:', schedulerConfig.currentGame || 'bingo_crash');
      schedulerStatus.currentGame = schedulerConfig.currentGame || 'bingo_crash';

      if (schedulerConfig.enabled) {
        const now = new Date();
        let timeUntilNextGame = null;
        let canPurchaseCards = true;
        let currentPhase = schedulerConfig.currentPhase || 'setup';

        if (schedulerConfig.nextGameStart) {
          const nextGameTime = new Date(schedulerConfig.nextGameStart);
          const timeDiff = nextGameTime.getTime() - now.getTime();
          
          if (timeDiff > 0) {
            timeUntilNextGame = Math.floor(timeDiff / 1000);
            
            if (timeUntilNextGame <= schedulerConfig.purchaseBlockSeconds) {
              canPurchaseCards = false;
            }
          } else {
            timeUntilNextGame = 0;
            currentPhase = 'starting';
          }
        }

        schedulerStatus = {
          enabled: true,
          timeUntilNextGame,
          canPurchaseCards,
          currentPhase,
          nextGameStart: schedulerConfig.nextGameStart,
          preBuyMinutes: schedulerConfig.preBuyMinutes,
          winnerDisplaySeconds: schedulerConfig.winnerDisplaySeconds,
          purchaseBlockSeconds: schedulerConfig.purchaseBlockSeconds,
          currentGame: schedulerConfig.currentGame || 'bingo_crash'
        };
      }
    }

    // Winner display auto-transition: keep 'ended' visible for duration then move to setup
    try {
      const sCfg = (schedulerResult.status === 'fulfilled' && !schedulerResult.value.error) ? (schedulerResult.value.data?.value || {}) : {};
      if (sCfg.enabled && sCfg.currentPhase === 'winner_display') {
        const at = sCfg.winnerDisplayAt ? new Date(sCfg.winnerDisplayAt).getTime() : 0;
        const waitMs = (sCfg.winnerDisplaySeconds != null ? sCfg.winnerDisplaySeconds : 20) * 1000;
        if (at && (Date.now() - at) >= waitMs) {
          // Move scheduler to setup and create a setup round for the current game
          const next = new Date(Date.now() + (sCfg.preBuyMinutes || 2) * 60 * 1000).toISOString();
          const updated = { ...sCfg, currentPhase: 'setup', nextGameStart: next };
          await supabaseAdmin
            .from(tableNames.config)
            .upsert({ key: 'scheduler', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });

          // Ensure setup round exists for this game
          const { data: latestForGame } = await supabaseAdmin
            .from(tableNames.rounds)
            .select('id, phase')
            .eq('game_type', updated.currentGame || 'bingo_crash')
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          if (!latestForGame || latestForGame.phase !== 'setup') {
            await supabaseAdmin
              .from(tableNames.rounds)
              .insert({ phase:'setup', called:[], speed_ms:800, prize_pool:0, total_collected:0, game_type: updated.currentGame || 'bingo_crash' });
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Winner display auto-transition failed:', e);
    }

    // Scramblingo: Precompute draw order and winner in last N seconds of setup
    try {
      const isScramblingo = schedulerStatus.currentGame === 'scramblingo';
      const inFinalSeconds = schedulerStatus.enabled && schedulerStatus.timeUntilNextGame !== null && schedulerStatus.timeUntilNextGame <= (schedulerStatus.purchaseBlockSeconds || 8);
      if (isScramblingo && inFinalSeconds) {
        // Fetch latest Scramblingo round in setup
        const { data: setupRound, error: setupErr } = await supabaseAdmin
          .from(tableNames.rounds)
          .select('*')
          .eq('game_type', 'scramblingo')
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        if (!setupErr && setupRound && setupRound.phase === 'setup' && (!setupRound.draw_order || setupRound.draw_order.length === 0)) {
          // Build shuffled 1..52
          const nums = Array.from({ length: 52 }, (_, i) => i + 1);
          for (let i = nums.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [nums[i], nums[j]] = [nums[j], nums[i]];
          }

          // Load purchased Scramblingo cards (purchased=true preferred, fallback to any cards)
          const { data: cards } = await supabaseAdmin
            .from(tableNames.cards)
            .select('id, numbers, player_alias, purchased')
            .eq('round_id', setupRound.id)
            .eq('game_type', 'scramblingo');

          let winnerIndex: number | null = null;
          const winnerAliases: Set<string> = new Set();
          (cards || []).forEach((c: any) => {
            // If purchase flag exists, prioritize purchased cards only
            if (cards?.some((x:any)=>x.purchased === true)) {
              if (!c.purchased) return;
            }
            const target = new Set<number>(c?.numbers || []);
            let matches = 0;
            for (let idx = 0; idx < nums.length; idx++) {
              if (target.has(nums[idx])) {
                matches++;
                if (matches >= 6) {
                  // Store as 1-based call count
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
            .eq('id', setupRound.id);
        }
      }
    } catch (e) {
      console.error('Scramblingo precompute in status failed:', e);
    }

    // Ensure the round matches the currently selected game type
    // If the fetched round is for a different game (or no round found),
    // fetch the latest round filtered by the current game type so clients
    // (like Scramblingo) receive a valid round id for their game.
    try {
      const currentGameType = schedulerStatus.currentGame || 'bingo_crash';
      let shouldRefetchRoundForGame = true;
      // If we already have a round id, check if it belongs to the current game
      if (roundState.id) {
        const { data: existingRound, error: existingRoundError } = await supabaseAdmin
          .from(tableNames.rounds)
          .select('id, game_type, phase, called, speed_ms, prize_pool, winner_alias, winner_daubs')
          .eq('id', roundState.id)
          .maybeSingle();
        if (!existingRoundError && existingRound && existingRound.game_type === currentGameType) {
          shouldRefetchRoundForGame = false;
        }
      }

      if (shouldRefetchRoundForGame) {
        const { data: gameRound, error: gameRoundError } = await supabaseAdmin
          .from(tableNames.rounds)
          .select('id, phase, called, speed_ms, prize_pool, winner_alias, winner_daubs')
          .eq('game_type', currentGameType)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!gameRoundError && gameRound) {
          // Optionally compute liveCardsCount/playerCount here if needed; keep zeros for now
          roundState = {
            id: gameRound.id,
            phase: gameRound.phase,
            called: gameRound.called || [],
            speed_ms: gameRound.speed_ms || 800,
            live_cards_count: roundState.live_cards_count,
            player_count: roundState.player_count,
            prize_pool: gameRound.prize_pool || 0,
            winner: gameRound.winner_alias ? {
              alias: gameRound.winner_alias,
              daubs: gameRound.winner_daubs || 0
            } : null
          };
        }
      }
    } catch (e) {
      // Non-fatal: keep existing roundState
      console.warn('⚠️ Failed to align round with current game type:', e);
    }

    // Process pricing configuration
    let pricing = {
      cardPrice: 10,
      shieldPricePercent: 50
    };

    if (pricingResult.status === 'fulfilled' && !pricingResult.value.error) {
      const pricingData = pricingResult.value.data;
      if (pricingData) {
        pricingData.forEach(item => {
          if (item.key === 'card_price') {
            pricing.cardPrice = Number(item.value) || 10;
          } else if (item.key === 'shield_price_percent') {
            pricing.shieldPricePercent = Number(item.value) || 50;
          }
        });
      }
    }

        // Compute players near win (1 letter away = 5/6 complete) for Scramblingo
        let playersNearWin = 0;
        try {
          const isScramblingo = schedulerStatus.currentGame === 'scramblingo';
          if (isScramblingo && roundState.id && roundState.phase === 'live') {
            // Count distinct players with cards that have exactly 5 daubs (5/6 complete)
            const { count: nearWinCount } = await supabaseAdmin
              .from(tableNames.cards)
              .select('player_alias', { count: 'exact', head: true })
              .eq('round_id', roundState.id)
              .eq('game_type', 'scramblingo')
              .not('completed', 'eq', true);
            
            // Filter to only cards with exactly 5 daubs
            const { data: cardsData } = await supabaseAdmin
              .from(tableNames.cards)
              .select('player_alias, daubed_positions')
              .eq('round_id', roundState.id)
              .eq('game_type', 'scramblingo');
            
            if (cardsData) {
              const playersWith5Daubs = new Set(
                cardsData
                  .filter(c => Array.isArray(c.daubed_positions) && c.daubed_positions.filter(Boolean).length === 5)
                  .map(c => c.player_alias)
                  .filter(Boolean)
              );
              playersNearWin = playersWith5Daubs.size;
            }
          }
        } catch (e) {
          console.warn('Failed to calculate players near win:', e);
        }

        // Compute Scramblingo pot reliably (after pricing and scheduler are known)
        try {
          const isScramblingo = schedulerStatus.currentGame === 'scramblingo';
          if (isScramblingo && roundState.id && (roundState.phase === 'setup' || roundState.phase === 'live')) {
            let purchasedCount = 0;
            const purchasedRes = await supabaseAdmin
              .from(tableNames.cards)
              .select('id', { count: 'exact', head: true })
              .eq('round_id', roundState.id)
              .eq('game_type', 'scramblingo')
              .eq('purchased', true);
            purchasedCount = purchasedRes.count || 0;
            if (purchasedCount === 0) {
              const allRes = await supabaseAdmin
                .from(tableNames.cards)
                .select('id', { count: 'exact', head: true })
                .eq('round_id', roundState.id)
                .eq('game_type', 'scramblingo');
              purchasedCount = allRes.count || 0;
            }
            const bets = purchasedCount * (pricing.cardPrice || 0);
            roundState.prize_pool = Math.floor(bets * 0.65);
          } else if (isScramblingo && roundState.id && roundState.phase === 'ended' && !roundState.prize_pool) {
            const { count } = await supabaseAdmin
              .from(tableNames.cards)
              .select('id', { count: 'exact', head: true })
              .eq('round_id', roundState.id)
              .eq('game_type', 'scramblingo');
            const bets = (count || 0) * (pricing.cardPrice || 0);
            roundState.prize_pool = Math.floor(bets * 0.65);
          }
        } catch (e) {
          console.warn('⚠️ Failed to compute current pot:', e);
        }

    // Predict winning cards for Scramblingo using precomputed draw_order and winner_call_index
    let predictedWinnerCards: Array<{ id?: string; player_alias: string; letters: string[] }> = [];
    try {
      if (schedulerStatus.currentGame === 'scramblingo' && roundState.id) {
        const { data: roundMeta } = await supabaseAdmin
          .from(tableNames.rounds)
          .select('id, draw_order, winner_call_index')
          .eq('id', roundState.id)
          .maybeSingle();
        const drawOrder: number[] = (roundMeta?.draw_order || []) as number[];
        const winnerIdx: number = Number(roundMeta?.winner_call_index ?? 0);
        if (Array.isArray(drawOrder) && drawOrder.length > 0 && winnerIdx > 0) {
          const k = Math.min(winnerIdx, drawOrder.length);
          const calledSet = new Set(drawOrder.slice(0, k));
          const { data: cardsForPred } = await supabaseAdmin
            .from(tableNames.cards)
            .select('id, player_alias, numbers, letters')
            .eq('round_id', roundState.id)
            .eq('game_type', 'scramblingo')
            .eq('purchased', true);
          if (Array.isArray(cardsForPred)) {
            for (const c of cardsForPred) {
              const nums: number[] = (c.numbers || []) as number[];
              if (Array.isArray(nums) && nums.length === 6 && nums.every(n => calledSet.has(Number(n)))) {
                const letters: string[] = Array.isArray(c.letters) && c.letters.length === 6
                  ? (c.letters as string[])
                  : nums.map(n => String.fromCharCode( (n<=26 ? 64 + n : 70 + n) ));
                predictedWinnerCards.push({ id: c.id, player_alias: c.player_alias, letters });
              }
            }
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to compute predicted winner cards:', e);
    }

    // Ensure a setup round exists for the current game when scheduler is in setup
    // OR when no round exists at all (first load scenario)
    try {
      const currentGame = schedulerStatus.currentGame || 'bingo_crash';
      const shouldEnsureRound = (
        (schedulerStatus.enabled && schedulerStatus.currentPhase === 'setup') ||
        (!roundState.id && currentGame === 'bingo_crash') // First load: ensure Bingo Crash has a round
      );

      if (shouldEnsureRound) {
        // Fetch latest round for this game
        const { data: latestForGame } = await supabaseAdmin
          .from(tableNames.rounds)
          .select('id, phase, called, speed_ms, prize_pool, winner_alias, winner_daubs')
          .eq('game_type', currentGame)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!latestForGame || latestForGame.phase !== 'setup') {
          // Create a setup round to keep Admin Round Control in sync with scheduler
          // OR for first load when no round exists
          console.log(`🎮 Game Status API - Creating setup round for ${currentGame} (first load or scheduler setup)`);
          const { data: created } = await supabaseAdmin
            .from(tableNames.rounds)
            .insert({
              phase: 'setup',
              called: [],
              speed_ms: 800,
              prize_pool: 0,
              total_collected: 0,
              game_type: currentGame
            })
            .select()
            .single();

          if (created) {
            roundState = {
              id: created.id,
              phase: created.phase,
              called: created.called || [],
              speed_ms: created.speed_ms || 800,
              live_cards_count: 0,
              player_count: 0,
              prize_pool: created.prize_pool || 0,
              winner: null
            } as any;
            console.log(`✅ Game Status API - Created setup round ${created.id} for ${currentGame}`);
          }
        }
      }
    } catch (e) {
      console.warn('⚠️ Failed to ensure setup round for current game:', e);
    }

    // Process wallet balance
    let wallet: WalletInfo = {
      balance: null,
      hasPlayer: false
    };

    if (alias && walletResult.status === 'fulfilled' && !walletResult.value.error) {
      const walletData = walletResult.value.data;
      if (walletData) {
        wallet = {
          balance: Math.round(Number(walletData.wallet_balance) * 100) / 100 || 1000,
          hasPlayer: true
        };
      } else {
        // Player doesn't exist yet - will be created on first purchase
        wallet = {
          balance: 1000, // Default starting balance
          hasPlayer: false
        };
      }
    } else if (alias) {
      // Wallet not loaded (not in setup phase, not winner, no buy action)
      // Return null to indicate wallet data not available
      wallet = {
        balance: null,
        hasPlayer: false
      };
    }

    // Build merged response
    console.log('🎮 Game Status API - Final schedulerStatus:', schedulerStatus);
    const mergedResponse = {
      roundState: {
        ...roundState,
        players_near_win: playersNearWin
      },
      schedulerStatus,
      pricing,
      wallet,
      predictedWinnerCards,
      timestamp: new Date().toISOString()
    };

    // Cache the response
    lastGameStatus = mergedResponse;
    lastCacheTime = now;

    const totalTime = Date.now() - startTime;
    if (totalTime > 200) {
      console.warn(`⚠️  SLOW MERGED API: ${totalTime}ms`);
    }

    return NextResponse.json(mergedResponse, { headers: { 'Cache-Control': 'no-store' }});
    
  } catch (error) {
    console.error('Error in merged game status endpoint:', error);
    return NextResponse.json({ 
      error: 'Failed to fetch game status',
      roundState: {
        id: null,
        phase: 'setup',
        called: [],
        speed_ms: 800,
        live_cards_count: 0,
        player_count: 0,
        prize_pool: 0,
        winner: null
      },
      schedulerStatus: {
        enabled: false,
        timeUntilNextGame: null,
        canPurchaseCards: true,
        currentPhase: 'manual',
        nextGameStart: null,
        preBuyMinutes: 2,
        winnerDisplaySeconds: 1,
        purchaseBlockSeconds: 5,
        currentGame: 'bingo_crash'
      },
      pricing: {
        cardPrice: 10,
        shieldPricePercent: 50
      },
      wallet: {
        balance: null,
        hasPlayer: false
      },
      timestamp: new Date().toISOString()
    }, { status: 500 });
  }
}
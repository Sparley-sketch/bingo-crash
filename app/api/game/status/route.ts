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
        .select('id, phase, called, speed_ms, prize_pool, winner_alias, winner_daubs')
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
      const shouldLoadWallet = round && (
        round.phase === 'setup' || 
        round.winner_alias === alias ||
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
          prize_pool: round.prize_pool || 0,
          winner: round.winner_alias ? {
            alias: round.winner_alias,
            daubs: round.winner_daubs || 0
          } : null
        };
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
      purchaseBlockSeconds: 5
    };

    if (schedulerResult.status === 'fulfilled' && !schedulerResult.value.error) {
      const schedulerData = schedulerResult.value.data;
      const schedulerConfig = schedulerData?.value || {
        enabled: false,
        preBuyMinutes: 2,
        nextGameStart: null,
        currentPhase: 'setup',
        winnerDisplaySeconds: 1,
        purchaseBlockSeconds: 5
      };

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
          purchaseBlockSeconds: schedulerConfig.purchaseBlockSeconds
        };
      }
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
    const mergedResponse = {
      roundState,
      schedulerStatus,
      pricing,
      wallet,
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
        purchaseBlockSeconds: 5
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
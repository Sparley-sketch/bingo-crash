import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames, isDev } from '@/lib/config';
import { getCertifiedShuffle } from '@/lib/certifiedRNG';

export const dynamic = 'force-dynamic';

// 5x3 grid, 15 numbers (1..25) with 3 bombs at random positions.
function makeCard(id: string, name: string) {
  function shuffle(a: number[]) {
    // Use certified RNG for shuffling
    return getCertifiedShuffle(a);
  }

  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map(r => nums.slice(r * 5, r * 5 + 5));
  const bombIdxs = new Set(shuffle(Array.from({ length: 15 }, (_, i) => i)).slice(0, 3));
  
  // Create simple integer grid for database (INTEGER[][])
  const grid = gridNums.map((row, r) =>
    row.map((n, c) => n)  // Just the numbers, no objects
  );
  
  // Store bomb positions separately if needed
  const bombPositions = Array.from(bombIdxs);
  
  return {
    id, name, grid, bombPositions,
    paused: false, exploded: false, daubs: 0,
    wantsShield: false, shieldUsed: false,
    justExploded: false, justSaved: false
  };
}

export async function POST(req: Request) {
  try {
    console.log('Buy endpoint called');
    
    // Log request details for debugging
    const userAgent = req.headers.get('user-agent') || 'unknown';
    const isMobile = userAgent.toLowerCase().includes('mobile');
    console.log(`Request from ${isMobile ? 'MOBILE' : 'DESKTOP'} device: ${userAgent}`);
    
    const { alias, cardName, wantsShield } = await req.json().catch(() => ({}));
    
    if (!alias) return NextResponse.json({ error: 'alias required' }, { status: 400 });
    if (!cardName) return NextResponse.json({ error: 'cardName required' }, { status: 400 });

    // Get pricing configuration
    const { data: pricingData, error: pricingError } = await supabaseAdmin
      .from(tableNames.config)
      .select('key, value')
      .in('key', ['card_price', 'shield_price_percent']);

    if (pricingError) {
      console.error('Error fetching pricing:', pricingError);
      return NextResponse.json({ error: 'Failed to fetch pricing' }, { status: 500 });
    }

    let cardPrice = 10;
    let shieldPricePercent = 50;

    pricingData?.forEach(item => {
      if (item.key === 'card_price') {
        cardPrice = Number(item.value) || 10;
      } else if (item.key === 'shield_price_percent') {
        shieldPricePercent = Number(item.value) || 50;
      }
    });

    // Calculate costs with proper rounding to 2 decimal places
    const shieldCost = wantsShield ? Math.round(cardPrice * (shieldPricePercent / 100) * 100) / 100 : 0;
    const totalCost = Math.round((cardPrice + shieldCost) * 100) / 100;

    console.log(`Pricing: card=${cardPrice}, shield=${shieldCost}, total=${totalCost}`);

    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id')
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

    const globalPlayersTable = isDev ? 'global_players_dev' : 'global_players';

    // Get or create global player (wallet persists across rounds)
    let { data: globalPlayer, error: globalPlayerError } = await supabaseAdmin
      .from(globalPlayersTable)
      .select('id, wallet_balance')
      .eq('alias', alias)
      .maybeSingle();

    if (globalPlayerError) {
      console.error('Error fetching global player:', globalPlayerError);
      return NextResponse.json({ error: 'Failed to fetch global player' }, { status: 500 });
    }

    if (!globalPlayer) {
      // Create global player with starting balance
      const { data: newGlobalPlayer, error: insertError } = await supabaseAdmin
        .from(globalPlayersTable)
        .insert([{ alias, wallet_balance: 1000.00 }])
        .select('id, wallet_balance')
        .single();

      if (insertError) {
        console.error('Error creating global player:', insertError);
        return NextResponse.json({ error: `Failed to create global player: ${insertError.message}` }, { status: 500 });
      }
      globalPlayer = newGlobalPlayer;
      console.log('New global player created:', globalPlayer);
    }

    // Check if player has enough balance
    const currentBalance = Math.round(Number(globalPlayer.wallet_balance) * 100) / 100 || 0;
    console.log(`Current balance check: alias=${alias}, balance=${currentBalance}, cost=${totalCost}`);
    
    if (currentBalance < totalCost) {
      return NextResponse.json({ 
        error: `Insufficient balance. Need ${totalCost} coins, have ${currentBalance} coins.` 
      }, { status: 400 });
    }

    // Deduct cost from global player's wallet with proper rounding
    const newBalance = Math.round((currentBalance - totalCost) * 100) / 100;
    console.log(`Balance calculation: ${currentBalance} - ${totalCost} = ${newBalance}`);
    
    const { error: walletError } = await supabaseAdmin
      .from(globalPlayersTable)
      .update({ wallet_balance: newBalance })
      .eq('id', globalPlayer.id);

    if (walletError) {
      console.error('Error updating global wallet:', walletError);
      return NextResponse.json({ error: 'Failed to update wallet' }, { status: 500 });
    }

    console.log(`Global wallet updated: ${currentBalance} -> ${newBalance} (deducted ${totalCost})`);

    // Get or create round-specific player (for game tracking)
    console.log(`Looking for round player: alias="${alias}", round_id=${round.id}`);
    
    let { data: player, error: playerError } = await supabaseAdmin
      .from(tableNames.players)
      .select('id')
      .eq('round_id', round.id)
      .eq('alias', alias)
      .single();

    if (playerError && playerError.code === 'PGRST116') {
      // Create round-specific player (wallet_balance not used here)
      const { data: newPlayer, error: insertError } = await supabaseAdmin
        .from(tableNames.players)
        .insert([{ round_id: round.id, alias }])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating round player:', insertError);
        return NextResponse.json({ error: `Failed to create round player: ${insertError.message}` }, { status: 500 });
      }
      player = newPlayer;
      console.log('New round player created:', player);
    } else if (playerError) {
      console.error('Error fetching round player:', playerError);
      return NextResponse.json({ error: 'Failed to fetch round player' }, { status: 500 });
    }

    // Ensure player exists
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Create a new card with proper bingo structure
    // Generate a proper UUID for the card ID
    const cardId = crypto.randomUUID();
    const newCard = makeCard(cardId, cardName);

    // Insert card into database with cost tracking
    const { error: cardError } = await supabaseAdmin
      .from(tableNames.cards)
      .insert([{
        id: newCard.id,
        round_id: round.id,
        player_id: player.id,
        name: newCard.name,
        grid: newCard.grid,
        numbers: newCard.grid.flat(), // Flatten grid to numbers array
        bomb_positions: newCard.bombPositions, // Store bomb positions
        paused: newCard.paused,
        exploded: newCard.exploded,
        daubs: newCard.daubs,
        wants_shield: wantsShield || false,
        shield_used: newCard.shieldUsed,
        just_exploded: newCard.justExploded,
        just_saved: newCard.justSaved,
        card_cost: cardPrice,
        shield_cost: shieldCost
      }]);

    if (cardError) {
      console.error('Error creating card:', cardError);
      console.error('Card insert details:', { 
        cardId: newCard.id, 
        roundId: round.id, 
        playerId: player.id,
        cardData: {
          name: newCard.name,
          grid: newCard.grid,
          paused: newCard.paused,
          exploded: newCard.exploded,
          daubs: newCard.daubs,
          wants_shield: wantsShield,
          shield_used: newCard.shieldUsed,
          just_exploded: newCard.justExploded,
          just_saved: newCard.justSaved,
          card_cost: cardPrice,
          shield_cost: shieldCost
        }
      });
      return NextResponse.json({ error: `Failed to create card: ${cardError.message}` }, { status: 500 });
    }

    // Update round prize pool (65% of total collected)
    const { data: currentRound, error: roundFetchError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('total_collected, prize_pool')
      .eq('id', round.id)
      .single();

    if (!roundFetchError && currentRound) {
      const newTotalCollected = Math.round(((Number(currentRound.total_collected) || 0) + totalCost) * 100) / 100;
      const newPrizePool = Math.round(newTotalCollected * 0.65 * 100) / 100;

      const { error: prizeError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ 
          total_collected: newTotalCollected,
          prize_pool: newPrizePool
        })
        .eq('id', round.id);

      if (prizeError) {
        console.error('Error updating prize pool:', prizeError);
      } else {
        console.log(`Prize pool updated: ${newPrizePool} (from ${newTotalCollected} collected)`);
      }
    }

    // Get total cards for this player
    const { data: cardsData, error: cardsError } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id')
      .eq('player_id', player.id);

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
    }

    return NextResponse.json({ 
      ok: true, 
      cardId: newCard.id,
      totalCards: cardsData?.length || 1,
      newBalance: newBalance,
      cost: totalCost,
      cardPrice: cardPrice,
      shieldCost: shieldCost
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in buy endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

// 5x3 grid, 15 numbers (1..25) with 3 bombs at random positions.
function makeCard(id: string, name: string) {
  function shuffle(a: number[]) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map(r => nums.slice(r * 5, r * 5 + 5));
  const bombIdxs = new Set(shuffle(Array.from({ length: 15 }, (_, i) => i)).slice(0, 3));
  const grid = gridNums.map((row, r) =>
    row.map((n, c) => {
      const flat = r * 5 + c;
      return { n, bomb: bombIdxs.has(flat), daubed: false };
    })
  );
  
  return {
    id, name, grid,
    paused: false, exploded: false, daubs: 0,
    wantsShield: false, shieldUsed: false,
    justExploded: false, justSaved: false
  };
}

export async function POST(req: Request) {
  try {
    const { alias, cardName } = await req.json().catch(() => ({}));
    
    if (!alias) return NextResponse.json({ error: 'alias required' }, { status: 400 });
    if (!cardName) return NextResponse.json({ error: 'cardName required' }, { status: 400 });

    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from('rounds')
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

    // Get or create player
    console.log(`Looking for existing player: alias=${alias}, round_id=${round.id}`);
    let { data: player, error: playerError } = await supabaseAdmin
      .from('players')
      .select('id')
      .eq('round_id', round.id)
      .eq('alias', alias)
      .single();

    console.log('Player lookup result:', { player, playerError });

    if (playerError && playerError.code === 'PGRST116') {
      // Player doesn't exist, create them
      console.log(`Creating new player: alias=${alias}, round_id=${round.id}`);
      const { data: newPlayer, error: insertError } = await supabaseAdmin
        .from('players')
        .insert([{ round_id: round.id, alias }])
        .select('id')
        .single();

      if (insertError) {
        console.error('Error creating player:', insertError);
        console.error('Player insert details:', { round_id: round.id, alias });
        return NextResponse.json({ error: `Failed to create player: ${insertError.message}` }, { status: 500 });
      }
      player = newPlayer;
      console.log('New player created:', player);
    } else if (playerError) {
      console.error('Error fetching player:', playerError);
      return NextResponse.json({ error: 'Failed to fetch player' }, { status: 500 });
    } else {
      console.log('Found existing player:', player);
    }

    // Ensure player exists
    if (!player) {
      return NextResponse.json({ error: 'Player not found' }, { status: 404 });
    }

    // Create a new card with proper bingo structure
    const newCard = makeCard(`card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, cardName);

    // Insert card into database
    const { error: cardError } = await supabaseAdmin
      .from('cards')
      .insert([{
        id: newCard.id,
        round_id: round.id,
        player_id: player.id,
        name: newCard.name,
        grid: newCard.grid,
        paused: newCard.paused,
        exploded: newCard.exploded,
        daubs: newCard.daubs,
        wants_shield: newCard.wantsShield,
        shield_used: newCard.shieldUsed,
        just_exploded: newCard.justExploded,
        just_saved: newCard.justSaved
      }]);

    if (cardError) {
      console.error('Error creating card:', cardError);
      return NextResponse.json({ error: 'Failed to create card' }, { status: 500 });
    }

    // Get total cards for this player
    const { data: cardsData, error: cardsError } = await supabaseAdmin
      .from('cards')
      .select('id')
      .eq('player_id', player.id);

    if (cardsError) {
      console.error('Error fetching cards:', cardsError);
    }

    return NextResponse.json({ 
      ok: true, 
      cardId: newCard.id,
      totalCards: cardsData?.length || 1
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in buy endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
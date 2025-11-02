import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { scramblingoGame, LetterMapper } from '@/lib/scramblingo/gameLogic';
import { GAME_TYPES } from '@/lib/gameConstants';
import { unifiedRNG } from '@/lib/unifiedRNG';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { action, playerId, roundId, letters, cardId, calledLetter } = body;

    if (!action) {
      return NextResponse.json({ error: 'Action is required' }, { status: 400 });
    }

    switch (action) {
      case 'create_card':
        return await createCard(body);
      case 'create_random_card':
        return await createRandomCard(body);
      case 'create_random_bulk':
        return await createRandomBulk(body);
      case 'purchase_card':
        return await purchaseCard(body);
      case 'get_cards':
        return await getCards(body);
      case 'get_completed':
        return await getCompletedCards(body);
      case 'daub_letter':
        return await daubLetter(body);
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Scramblingo API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function createCard(body: any) {
  try {
    const { playerId, roundId, letters } = body;
    
    console.log('🎮 Scramblingo API - createCard called with:', { playerId, roundId, letters });

    if (!playerId || !roundId || !letters) {
      return NextResponse.json({ error: 'Player ID, Round ID, and letters are required' }, { status: 400 });
    }

    // Check if round exists and is Scramblingo; do NOT auto-create to avoid mismatch/409s
    const targetRoundId = roundId;
    const { data: roundData, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id, game_type, phase')
      .eq('id', targetRoundId)
      .single();

    if (roundError || !roundData) {
      console.error('🎮 Scramblingo API - Round not found:', roundError);
      return NextResponse.json({ error: `Round not found: ${targetRoundId}` }, { status: 404 });
    }

    if (roundData.game_type !== GAME_TYPES.SCRAMBLINGO) {
      console.error('🎮 Scramblingo API - Round game_type mismatch:', roundData.game_type);
      return NextResponse.json({ error: `Round is not for Scramblingo game (${roundData.game_type})` }, { status: 400 });
    }

    // Enforce per-player card cap (200 cards per round)
    const { count: existingCount } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id', { count: 'exact', head: true })
      .eq('player_alias', playerId)
      .eq('round_id', targetRoundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO);
    if ((existingCount || 0) >= 200) {
      return NextResponse.json({ error: 'Maximum card limit reached (200 cards)' }, { status: 400 });
    }

    // Validate and create card
    const cardLetters = scramblingoGame.createCardFromLetters(letters);
    const card = scramblingoGame.createCard(playerId, targetRoundId, cardLetters);

    // Save to database
    const { data, error } = await supabaseAdmin
      .from(tableNames.cards)
      .insert({
        id: card.id,
        round_id: targetRoundId,
        player_alias: playerId,
        game_type: GAME_TYPES.SCRAMBLINGO,
        letters: card.letters,
        numbers: card.numbers,
        daubs: 0,
        daubed_positions: card.daubed_positions,
        completed: false,
        purchased: true,
        purchased_at: new Date().toISOString(),
        created_at: card.created_at
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving Scramblingo card:', error);
      console.error('Card data being inserted:', {
        id: card.id,
        round_id: roundId,
        player_id: playerId, // Add player_id for NOT NULL constraint
        player_alias: playerId,
        game_type: GAME_TYPES.SCRAMBLINGO,
        letters: card.letters,
        numbers: card.numbers,
        daubs: 0,
        daubed_positions: card.daubed_positions,
        completed: false,
        created_at: card.created_at
      });
      return NextResponse.json({ error: `Failed to save card: ${error.message}` }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      card: data 
    });
  } catch (error: any) {
    console.error('Error creating Scramblingo card:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function createRandomCard(body: any) {
  try {
    const { playerId, roundId } = body;

    if (!playerId || !roundId) {
      return NextResponse.json({ error: 'Player ID and Round ID are required' }, { status: 400 });
    }

    // Enforce per-player card cap (200 cards per round)
    const { count: existingCount } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id', { count: 'exact', head: true })
      .eq('player_alias', playerId)
      .eq('round_id', roundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO);
    if ((existingCount || 0) >= 200) {
      return NextResponse.json({ error: 'Maximum card limit reached (200 cards)' }, { status: 400 });
    }

    // Generate random card
    const randomLetters = scramblingoGame.generateRandomCard();
    const card = scramblingoGame.createCard(playerId, roundId, randomLetters);

    // Save to database
    const { data, error } = await supabaseAdmin
      .from(tableNames.cards)
      .insert({
        id: card.id,
        round_id: roundId,
        player_alias: playerId,
        game_type: GAME_TYPES.SCRAMBLINGO,
        letters: card.letters,
        numbers: card.numbers,
        daubs: 0,
        daubed_positions: card.daubed_positions,
        completed: false,
        purchased: true,
        purchased_at: new Date().toISOString(),
        created_at: card.created_at
      })
      .select()
      .single();

    if (error) {
      console.error('Error saving random Scramblingo card:', error);
      return NextResponse.json({ error: 'Failed to save card' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      card: data 
    });
  } catch (error: any) {
    console.error('Error creating random Scramblingo card:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function createRandomBulk(body: any) {
  try {
    const { playerId, roundId, qty } = body;

    const n = Math.max(1, Math.min(50, Number(qty || 1))); // safety bounds

    if (!playerId || !roundId) {
      return NextResponse.json({ error: 'Player ID and Round ID are required' }, { status: 400 });
    }

    // Enforce per-player card cap (200 cards per round)
    const { count: existingCount } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id', { count: 'exact', head: true })
      .eq('player_alias', playerId)
      .eq('round_id', roundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO);
    const already = existingCount || 0;
    if (already >= 200) {
      return NextResponse.json({ error: 'Maximum card limit reached (200 cards)' }, { status: 400 });
    }
    const allowed = Math.max(0, 200 - already);
    const toCreate = Math.min(n, allowed);
    if (toCreate <= 0) {
      return NextResponse.json({ error: 'Maximum card limit reached (200 cards)' }, { status: 400 });
    }

    // Generate N random cards server-side
    const rows: any[] = [];
    for (let i = 0; i < toCreate; i++) {
      const randomLetters = scramblingoGame.generateRandomCard();
      const card = scramblingoGame.createCard(playerId, roundId, randomLetters);
      rows.push({
        id: card.id,
        round_id: roundId,
        player_alias: playerId,
        game_type: GAME_TYPES.SCRAMBLINGO,
        letters: card.letters,
        numbers: card.numbers,
        daubs: 0,
        daubed_positions: card.daubed_positions,
        completed: false,
        purchased: true,
        purchased_at: new Date().toISOString(),
        created_at: card.created_at
      });
    }

    const { data, error } = await supabaseAdmin
      .from(tableNames.cards)
      .insert(rows)
      .select();

    if (error) {
      console.error('Error bulk-inserting Scramblingo cards:', error);
      return NextResponse.json({ error: 'Failed to save cards' }, { status: 500 });
    }

    return NextResponse.json({ success: true, cards: data || [], remaining: Math.max(0, allowed - (data?.length || 0)) });
  } catch (error: any) {
    console.error('Error creating Scramblingo cards (bulk):', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function purchaseCard(body: any) {
  try {
    const { playerId, roundId, cardId } = body;

    if (!playerId || !roundId || !cardId) {
      return NextResponse.json({ error: 'Player ID, Round ID, and Card ID are required' }, { status: 400 });
    }

    // Check if player can purchase (card count and time restrictions)
    const { data: playerCards, error: cardsError } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id', { count: 'exact', head: false })
      .eq('player_alias', playerId)
      .eq('round_id', roundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO);

    if (cardsError) {
      return NextResponse.json({ error: 'Failed to check card count' }, { status: 500 });
    }

    const cardCount = playerCards?.length || 0;
    
    // TODO: Check time until game start (need scheduler info)
    // For now, just check card limit
    if (cardCount >= 200) {
      return NextResponse.json({ error: 'Maximum card limit reached (200 cards)' }, { status: 400 });
    }

    // Mark card as purchased
    const { data, error } = await supabaseAdmin
      .from(tableNames.cards)
      .update({ 
        player_alias: playerId,
        purchased: true,
        purchased_at: new Date().toISOString()
      })
      .eq('id', cardId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO)
      .select()
      .single();

    if (error) {
      console.error('Error purchasing card:', error);
      return NextResponse.json({ error: 'Failed to purchase card' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      card: data,
      cardCount: cardCount + 1
    });
  } catch (error: any) {
    console.error('Error purchasing card:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function getCards(body: any) {
  try {
    const { playerId, roundId } = body;

    if (!playerId || !roundId) {
      return NextResponse.json({ error: 'Player ID and Round ID are required' }, { status: 400 });
    }

    const { data: cards, error } = await supabaseAdmin
      .from(tableNames.cards)
      .select('*')
      .eq('player_alias', playerId)
      .eq('round_id', roundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching cards:', error);
      return NextResponse.json({ error: 'Failed to fetch cards' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      cards: cards || []
    });
  } catch (error: any) {
    console.error('Error getting cards:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function getCompletedCards(body: any) {
  try {
    const { roundId } = body;

    if (!roundId) {
      return NextResponse.json({ error: 'Round ID is required' }, { status: 400 });
    }

    const { data: cards, error } = await supabaseAdmin
      .from(tableNames.cards)
      .select('id, player_alias, letters, numbers')
      .eq('round_id', roundId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO)
      .eq('completed', true);

    if (error) {
      console.error('Error fetching completed cards:', error);
      return NextResponse.json({ error: 'Failed to fetch completed cards' }, { status: 500 });
    }

    return NextResponse.json({ success: true, cards: cards || [] });
  } catch (error: any) {
    console.error('Error getting completed cards:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}

async function daubLetter(body: any) {
  try {
    const { cardId, calledLetter } = body;

    if (!cardId || !calledLetter) {
      return NextResponse.json({ error: 'Card ID and called letter are required' }, { status: 400 });
    }

    // Get card
    const { data: cardData, error: fetchError } = await supabaseAdmin
      .from(tableNames.cards)
      .select('*')
      .eq('id', cardId)
      .eq('game_type', GAME_TYPES.SCRAMBLINGO)
      .single();

    if (fetchError || !cardData) {
      return NextResponse.json({ error: 'Card not found' }, { status: 404 });
    }

    // Convert to ScramblingoCard format
    const card = {
      id: cardData.id,
      letters: cardData.letters || [],
      numbers: cardData.numbers || [],
      player_id: cardData.player_alias,
      round_id: cardData.round_id,
      daubs: cardData.daubs || 0,
      daubed_positions: cardData.daubed_positions || [],
      completed: cardData.completed || false,
      created_at: cardData.created_at
    };

    // Daub the letter
    const updatedCard = scramblingoGame.daubLetter(card, calledLetter);

    // Update in database
    const { data, error } = await supabaseAdmin
      .from(tableNames.cards)
      .update({
        daubs: updatedCard.daubs,
        daubed_positions: updatedCard.daubed_positions,
        completed: updatedCard.completed
      })
      .eq('id', cardId)
      .select()
      .single();

    if (error) {
      console.error('Error daubing letter:', error);
      return NextResponse.json({ error: 'Failed to daub letter' }, { status: 500 });
    }

    // If this card just completed, end the round and set winner(s)
    if (updatedCard.completed) {
      // Collect all completed winners for this round
      const { data: winners, error: winnersErr } = await supabaseAdmin
        .from(tableNames.cards)
        .select('player_alias')
        .eq('round_id', card.round_id)
        .eq('game_type', GAME_TYPES.SCRAMBLINGO)
        .eq('completed', true);
      if (winnersErr) {
        console.error('Failed fetching Scramblingo winners:', winnersErr);
      }
      const winnerAliases = (winners || []).map(w => w.player_alias).filter(Boolean);
      const winnersString = winnerAliases.length ? winnerAliases.join(',') : String(card.player_id || '');

      const { error: endErr } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({
          phase: 'ended',
          winner_alias: winnersString,
          winner_daubs: updatedCard.daubs,
          ended_at: new Date().toISOString()
        })
        .eq('id', card.round_id);
      if (endErr) {
        console.error('Failed to end Scramblingo round on winner:', endErr);
      }
    }

    return NextResponse.json({ 
      success: true, 
      card: data,
      isWinner: updatedCard.completed
    });
  } catch (error: any) {
    console.error('Error daubing letter:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
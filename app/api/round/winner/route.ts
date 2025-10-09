import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames, isDev } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
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

    // Allow winner API to work if we have alias and daubs in the request, regardless of phase
    const { alias, daubs, prizePool } = await req.json().catch(() => ({}));
    console.log('Winner API POST called with:', { alias, daubs, prizePool, roundId: round.id, currentRoundPrizePool: round.prize_pool, phase: round.phase });
    
    if (!alias || typeof daubs !== 'number') {
      return NextResponse.json({ error: 'Winner alias and daubs required' }, { status: 400 });
    }

    // Check if this round already has a winner to prevent duplicate prize awards
    if (round.winner_alias && round.winner_alias !== alias) {
      console.log(`Round ${round.id} already has winner ${round.winner_alias}, ignoring request for ${alias}`);
      return NextResponse.json({ 
        message: 'Round already has a different winner',
        existingWinner: round.winner_alias,
        requestedWinner: alias
      }, { status: 409 });
    }

    // Use provided prizePool or fall back to current round's prize_pool
    const actualPrizePool = prizePool !== undefined ? prizePool : (round.prize_pool || 0);

    if (alias && typeof daubs === 'number') {
      // Update winner in database using separate fields (only if not already set)
      const updateData: any = {};
      if (!round.winner_alias) updateData.winner_alias = alias;
      if (!round.winner_daubs) updateData.winner_daubs = daubs;
      
      if (Object.keys(updateData).length > 0) {
        const { error: updateError } = await supabaseAdmin
          .from(tableNames.rounds)
          .update(updateData)
          .eq('id', round.id);

        if (updateError) {
          console.error('Error updating winner:', updateError);
          return NextResponse.json({ error: 'Failed to update winner' }, { status: 500 });
        }
      }

      // Award prize money to winner's global wallet (only if not already awarded)
      if (actualPrizePool > 0) {
        const globalPlayersTable = isDev ? 'global_players_dev' : 'global_players';
        
        // Find the winner's global player record
        const { data: winnerPlayer, error: playerError } = await supabaseAdmin
          .from(globalPlayersTable)
          .select('id, wallet_balance')
          .eq('alias', alias)
          .maybeSingle();

        if (!playerError && winnerPlayer) {
          // Check if this round already has prize awarded to prevent duplicates
          const { data: roundCheck, error: roundCheckError } = await supabaseAdmin
            .from(tableNames.rounds)
            .select('prize_awarded')
            .eq('id', round.id)
            .single();

          if (roundCheckError) {
            console.error('Error checking if prize already awarded:', roundCheckError);
          }

          // If prize already awarded, skip
          if (roundCheck?.prize_awarded) {
            console.log(`Prize already awarded for round ${round.id}, skipping duplicate award`);
            return NextResponse.json({ 
              message: 'Prize already awarded for this round',
              alreadyAwarded: true
            }, { status: 200 });
          }

          const currentBalance = Math.round(Number(winnerPlayer.wallet_balance) * 100) / 100 || 0;
          const prizeAmount = Math.round(actualPrizePool * 100) / 100;
          const newBalance = Math.round((currentBalance + prizeAmount) * 100) / 100;
          
          // First get the current total_wins value
          const { data: currentPlayer, error: fetchError } = await supabaseAdmin
            .from(globalPlayersTable)
            .select('total_wins')
            .eq('id', winnerPlayer.id)
            .single();

          if (fetchError) {
            console.error('Error fetching current player data:', fetchError);
            return NextResponse.json({ error: 'Failed to fetch player data' }, { status: 500 });
          }

          const newTotalWins = (currentPlayer?.total_wins || 0) + 1;

          // Use a transaction to update wallet and mark prize as awarded
          const { error: walletError } = await supabaseAdmin
            .from(globalPlayersTable)
            .update({ 
              wallet_balance: newBalance,
              total_wins: newTotalWins
            })
            .eq('id', winnerPlayer.id);

          if (walletError) {
            console.error('Error updating winner wallet:', walletError);
          } else {
            // Mark prize as awarded in the round
            await supabaseAdmin
              .from(tableNames.rounds)
              .update({ prize_awarded: true })
              .eq('id', round.id);
              
            console.log(`Winner ${alias} awarded ${prizeAmount} coins. Balance: ${currentBalance} -> ${newBalance}`);
          }
        } else if (!winnerPlayer) {
          console.error(`Winner ${alias} not found in global players table`);
        }
      }
    }

    // Return winner information from separate fields
    const winner = round.winner_alias ? {
      alias: round.winner_alias,
      daubs: round.winner_daubs || 0
    } : null;

    return NextResponse.json({ 
      ok: true, 
      winner: winner 
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in winner endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET() {
  try {
    // Get current round with all columns to avoid missing column errors
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      return NextResponse.json(null, { headers: { 'Cache-Control': 'no-store' }});
    }

    // Return winner information from separate fields
    const winner = round.winner_alias ? {
      alias: round.winner_alias,
      daubs: round.winner_daubs || 0
    } : null;

    return NextResponse.json(winner, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in winner GET endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

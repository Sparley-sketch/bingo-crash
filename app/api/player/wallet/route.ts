import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isDev } from '@/lib/config';

export const dynamic = 'force-dynamic';

// GET - Get player's wallet balance from global players table
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const alias = searchParams.get('alias');

    if (!alias) {
      return NextResponse.json({ error: 'alias required' }, { status: 400 });
    }

    const globalPlayersTable = isDev ? 'global_players_dev' : 'global_players';

    // Get or create player in global players table
    let { data: player, error: playerError } = await supabaseAdmin
      .from(globalPlayersTable)
      .select('wallet_balance')
      .eq('alias', alias)
      .maybeSingle();

    if (playerError) {
      console.error('Error fetching global player wallet:', playerError);
      return NextResponse.json({ error: 'Failed to fetch player wallet' }, { status: 500 });
    }

    if (!player) {
      // Player doesn't exist yet, create them with starting balance
      const { data: newPlayer, error: insertError } = await supabaseAdmin
        .from(globalPlayersTable)
        .insert([{ alias, wallet_balance: 1000.00 }])
        .select('wallet_balance')
        .single();

      if (insertError) {
        console.error('Error creating global player:', insertError);
        return NextResponse.json({ error: 'Failed to create player' }, { status: 500 });
      }

      player = newPlayer;
      console.log(`Created new global player: ${alias} with balance 1000`);
    }

    const balance = Math.round(Number(player.wallet_balance) * 100) / 100 || 1000;

    return NextResponse.json({ 
      balance,
      hasPlayer: true
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in wallet endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

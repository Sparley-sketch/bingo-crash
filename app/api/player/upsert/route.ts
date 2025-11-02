import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { isDev } from '@/lib/config';

export const dynamic = 'force-dynamic';

// POST /api/player/upsert
// Body: { alias: string }
export async function POST(req: NextRequest) {
  try {
    const { alias } = await req.json();
    const clean = String(alias || '').trim();
    if (!clean) {
      return NextResponse.json({ error: 'Alias is required' }, { status: 400 });
    }

    const tbl = isDev ? 'global_players_dev' : 'global_players';

    // Check if alias exists
    const { data: existing } = await supabaseAdmin
      .from(tbl)
      .select('alias, wallet_balance')
      .eq('alias', clean)
      .maybeSingle();

    if (existing) {
      return NextResponse.json({ success: true, wallet: { alias: existing.alias, balance: Number(existing.wallet_balance || 0) } });
    }

    // Create new player
    const { data, error } = await supabaseAdmin
      .from(tbl)
      .insert({ alias: clean, wallet_balance: 0 })
      .select('alias, wallet_balance')
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create alias' }, { status: 500 });
    }

    return NextResponse.json({ success: true, wallet: { alias: data.alias, balance: Number(data.wallet_balance || 0) } });
  } catch (e) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



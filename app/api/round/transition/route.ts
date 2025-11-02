import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

// POST /api/round/transition
// Body: { roundId?: string }
// Effect: Moves system to setup phase and creates a fresh setup round for the current game.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { roundId } = body || {};

    // Get scheduler
    const { data: schedRow, error: schedErr } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (schedErr) {
      return NextResponse.json({ error: 'Failed to read scheduler' }, { status: 500 });
    }

    const cfg = schedRow?.value || { preBuyMinutes: 2, currentGame: 'bingo_crash' };
    const gameType = cfg.currentGame || 'bingo_crash';
    const preBuyMinutes = cfg.preBuyMinutes || 2;
    const next = new Date(Date.now() + preBuyMinutes * 60 * 1000).toISOString();

    // Update scheduler to setup
    const updated = { ...cfg, currentPhase: 'setup', nextGameStart: next };
    await supabaseAdmin
      .from(tableNames.config)
      .upsert({ key: 'scheduler', value: updated, updated_at: new Date().toISOString() }, { onConflict: 'key' });

    // Create a fresh setup round for the same game type
    await supabaseAdmin
      .from(tableNames.rounds)
      .insert({
        phase: 'setup',
        called: [],
        speed_ms: 800,
        prize_pool: 0,
        total_collected: 0,
        game_type: gameType
      });

    return NextResponse.json({ ok: true, nextGameStart: next, gameType });
  } catch (error) {
    console.error('Error transitioning to setup:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}



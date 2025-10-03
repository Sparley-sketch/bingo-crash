// app/api/round/end/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Admin (service-role) client: read/write rounds safely */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

function nocache() {
  return {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    pragma: 'no-cache',
    expires: '0',
    'content-type': 'application/json; charset=utf-8',
  };
}

/**
 * Returns true if a winner is already recorded for this round.
 * Adjust the table/column names below to match your schema.
 */
async function hasWinner(
  supabase: ReturnType<typeof admin>,
  roundId: string
): Promise<boolean> {
  // Pattern A: single row per round
  try {
    const { data, error } = await supabase
      .from('round_winner')
      .select('id')
      .eq('round_id', roundId)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) return true;
  } catch {}

  // Pattern B: multiple rows for ties
  try {
    const { data, error } = await supabase
      .from('winners')
      .select('id')
      .eq('round_id', roundId)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) return true;
  } catch {}

  // Pattern C: winner stored directly on rounds table (e.g., winner_alias)
  try {
    const { data, error } = await supabase
      .from('rounds')
      .select('winner_alias')
      .eq('id', roundId)
      .maybeSingle();
    if (!error && data && (data as any).winner_alias) return true;
  } catch {}

  return false;
}

export async function POST(req: Request) {
  try {
    const supabase = admin();
    const force = new URL(req.url).searchParams.get('force') === '1';

    // Fetch newest round (pure read)
    const { data: round, error } = await supabase
      .from('rounds')
      .select('id, phase, called, created_at')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ ok: false, error: error.message }, { status: 500, headers: nocache() });
    }
    if (!round) {
      return NextResponse.json({ ok: true, reason: 'no-round' }, { status: 200, headers: nocache() });
    }

    const r: any = round;
    const calls = Array.isArray(r.called) ? r.called.length : 0;

    // If not live, nothing to do (idempotent end)
    if (r.phase !== 'live') {
      return NextResponse.json(
        { ok: true, phase: r.phase, calls },
        { status: 200, headers: nocache() }
      );
    }

const calls = Array.isArray(r.called) ? r.called.length : 0;
const deckExhausted = calls >= 25;

// winner already present? (your existing helper)
const winnerAlready = await hasWinner(supabase, r.id);

// all joined players out?
const { data: joined } = await supabase.from('round_players').select('id').eq('round_id', r.id);
const { data: outs }   = await supabase.from('round_players').select('id').eq('round_id', r.id).not('out_at','is', null);
const allOut = (joined?.length || 0) > 0 && (joined!.length === (outs?.length || 0));

// allow end if any global condition holds (or force=1)
if (!(deckExhausted || winnerAlready || allOut) && !force) {
  return NextResponse.json(
    { ok:false, refused:true, reason:'deck-not-exhausted-and-no-winner-and-not-all-out', calls,
      joined: joined?.length || 0, outs: outs?.length || 0 },
    { status:409, headers:nocache() }
  );
}

    
    // Allow end when deck is exhausted OR a winner is already recorded.
    const deckExhausted = calls >= 25;
    const winnerAlready = await hasWinner(supabase, r.id);

    if (!(deckExhausted || winnerAlready) && !force) {
      return NextResponse.json(
        { ok: false, refused: true, reason: 'deck-not-exhausted-and-no-winner', calls },
        { status: 409, headers: nocache() }
      );
    }

    // End the round (guard on current phase so we don't clobber concurrent updates)
    const { data: updated, error: uerr } = await supabase
      .from('rounds')
      .update({ phase: 'ended' })
      .eq('id', r.id)
      .eq('phase', 'live') // only if still live at write time
      .select('id, phase, called')
      .maybeSingle();

    if (uerr) {
      return NextResponse.json({ ok: false, error: uerr.message }, { status: 500, headers: nocache() });
    }

    // If guard failed (someone else ended first), return success with current state
    if (!updated) {
      return NextResponse.json(
        { ok: true, phase: 'ended', calls },
        { status: 200, headers: nocache() }
      );
    }

    return NextResponse.json(
      { ok: true, phase: updated.phase, calls: Array.isArray(updated.called) ? updated.called.length : calls },
      { status: 200, headers: nocache() }
    );
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: e?.message || 'unknown' }, { status: 500, headers: nocache() });
  }
}

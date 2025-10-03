// app/api/round/end/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function hasWinner(
  supabase: ReturnType<typeof admin>,
  roundId: string
): Promise<boolean> {
  // Pattern A: table `round_winner` (one row per round)
  try {
    const { data, error } = await supabase
      .from('round_winner')
      .select('id')
      .eq('round_id', roundId)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) return true;
  } catch {}

  // Pattern B: table `winners` (could be multiple rows if ties)
  try {
    const { data, error } = await supabase
      .from('winners')
      .select('id')
      .eq('round_id', roundId)
      .limit(1);
    if (!error && (data?.length ?? 0) > 0) return true;
  } catch {}

  // Pattern C: winner stored on the round row itself
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

function nocache() {
  return {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    pragma: 'no-cache',
    expires: '0',
    'content-type': 'application/json; charset=utf-8',
  };
}

export async function POST(req: Request) {
  const force = new URL(req.url).searchParams.get('force') === '1'; // keep for admin tools only
  const supabase = admin();


  // newest round
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
  if ((round as any).phase !== 'live') {
    return NextResponse.json({ ok: true, reason: 'not-live' }, { status: 200, headers: nocache() });
  }

  const calls = Array.isArray((round as any).called) ? (round as any).called.length : 0;

  // 🔒 HARD GUARD: only end automatically if the deck is exhausted
const calls = Array.isArray((round as any).called) ? (round as any).called.length : 0;

// ✅ Allow end if deck exhausted OR a winner is already recorded.
//    Only refuse when neither is true (unless `force=1`).
const winnerAlready = await hasWinner(supabase, (round as any).id);

if (calls < 25 && !winnerAlready && !force) {
  return NextResponse.json(
    { ok: false, refused: true, reason: 'deck-not-exhausted-and-no-winner', calls },
    { status: 409, headers: nocache() }
  );
}


  const { error: uerr } = await supabase
    .from('rounds')
    .update({ phase: 'ended' })
    .eq('id', (round as any).id);

  if (uerr) {
    return NextResponse.json({ ok: false, error: uerr.message }, { status: 500, headers: nocache() });
  }
  return NextResponse.json({ ok: true, phase: 'ended', calls }, { status: 200, headers: nocache() });
}

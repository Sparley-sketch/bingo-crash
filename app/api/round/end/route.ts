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
  if (calls < 25 && !force) {
    return NextResponse.json(
      { ok: false, refused: true, reason: 'deck-not-exhausted', calls },
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

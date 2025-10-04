// app/api/round/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRound, recomputeLiveCardsCount } from '../../_lib/roundStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0; // do not cache

function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { persistSession: false } });
}

async function loadSpeedMs(supabase: ReturnType<typeof admin>) {
  // Try config key first
  try {
    const { data } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'round.duration_ms')
      .maybeSingle();

    const n = Number((data as any)?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {
    // ignore
  }
  return 800;
}

export async function GET() {
  const supabase = admin();

  // Read newest round only — NO WRITES HERE
  const { data: round, error } = await supabase
    .from('rounds')
    .select('id, phase, called, speed_ms, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: nocache() });
  }

  const speed = Number((round as any)?.speed_ms) || (await loadSpeedMs(supabase));

  const payload = round
    ? {
        id: (round as any).id,
        phase: (round as any).phase || 'setup',
        speed_ms: speed,
        called: Array.isArray((round as any).called) ? (round as any).called : [],
        created_at: (round as any).created_at,
      }
    : {
        id: null,
        phase: 'setup',
        speed_ms: speed,
        called: [],
        created_at: null,
      };

  return new NextResponse(JSON.stringify(payload), {
    status: 200,
    headers: {
      ...nocache(),
      'content-type': 'application/json; charset=utf-8',
      'x-round-state': 'pure-read',
    },
  });
}

function nocache() {
  return {
    'cache-control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
    pragma: 'no-cache',
    expires: '0',
  };
}
export async function GET() {
  const r = getRound();
  const live = recomputeLiveCardsCount(r);
  return NextResponse.json({
    id: r.id,
    phase: r.phase,
    called: r.called,
    speed_ms: r.speed_ms,
    live_cards_count: live
  });
}
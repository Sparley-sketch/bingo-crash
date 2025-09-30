// app/api/round/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Read speed from config, safely (no DB types available)
async function readConfigSpeed(supabase: ReturnType<typeof createClient>) {
  try {
    const res = await supabase
      .from('config')
      .select('value')
      .eq('key', 'round.duration_ms')
      .maybeSingle();

    // res.data is `never` without DB typings; cast to any
    const cfg: any = res.data;
    const n = Number(cfg?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {}
  return 800;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only key
  const supabase = createClient(url, key);

  // newest round (any phase)
  const { data: row, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Self-heal: if none OR newest is ended, create a fresh setup round
  if (!row || (row as any).phase === 'ended') {
    const speed_ms = await readConfigSpeed(supabase);
    const { data: inserted, error: insErr } = await supabase
      .from('rounds')
      .insert({ phase: 'setup', speed_ms, deck: [], called: [] })
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: insErr.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    const r: any = inserted;
    return NextResponse.json(
      { id: r.id, phase: r.phase, speed_ms: r.speed_ms, called: r.called, created_at: r.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const r: any = row;
  return NextResponse.json(
    { id: r.id, phase: r.phase, speed_ms: r.speed_ms, called: r.called, created_at: r.created_at },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

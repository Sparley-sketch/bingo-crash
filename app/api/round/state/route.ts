/* @ts-nocheck */
// app/api/round/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

// Read speed from config safely (works even if the table or row is missing)
async function readConfigSpeed(supabase: any): Promise<number> {
  try {
    const { data } = await supabase
      .from('config')
      .select('value')
      .eq('key', 'round.duration_ms')
      .maybeSingle();
    const n = Number(data?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {}
  return 800;
}

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase: any = createClient(url, key);

  // Get newest round (any phase)
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

  // Self-heal: if there is no row OR the newest is ended, create a fresh setup round
  if (!row || row.phase === 'ended') {
    const speed_ms = await readConfigSpeed(supabase);
    const { data: inserted, error: insErr } = await supabase
      .from('rounds')
      .insert([{ phase: 'setup', speed_ms, deck: [], called: [] }])
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json(
        { error: insErr.message },
        { status: 500, headers: { 'Cache-Control': 'no-store' } }
      );
    }

    return NextResponse.json(
      {
        id: inserted.id,
        phase: inserted.phase,
        speed_ms: inserted.speed_ms,
        called: inserted.called,
        created_at: inserted.created_at,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Return the current round as-is
  return NextResponse.json(
    {
      id: row.id,
      phase: row.phase,
      speed_ms: row.speed_ms,
      called: row.called,
      created_at: row.created_at,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

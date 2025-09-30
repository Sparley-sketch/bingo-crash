/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

async function readConfigSpeed(supabase: any) {
  try {
    const { data } = await supabase.from('config').select('value').eq('key','round.duration_ms').maybeSingle();
    const n = Number(data?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {}
  return 800;
}

export async function GET() {
  const supabase: any = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // 1) If there is a LIVE round, return it (this is what /play and Admin should follow)
  const { data: live, error: liveErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('phase', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (liveErr) {
    return NextResponse.json({ error: liveErr.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (live) {
    return NextResponse.json(
      { id: live.id, phase: live.phase, speed_ms: live.speed_ms, called: live.called, created_at: live.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 2) No LIVE round: get newest row (setup/ended/none)
  const { data: row, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  // 3) Self-heal: if none or newest is ENDED, create fresh SETUP
  if (!row || row.phase === 'ended') {
    const speed_ms = await readConfigSpeed(supabase);
    const { data: inserted, error: insErr } = await supabase
      .from('rounds')
      .insert([{ phase: 'setup', speed_ms, deck: [], called: [] }])
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
    }

    return NextResponse.json(
      { id: inserted.id, phase: inserted.phase, speed_ms: inserted.speed_ms, called: inserted.called, created_at: inserted.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // 4) Newest exists and is SETUP (or any non-live, non-ended)
  return NextResponse.json(
    { id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called, created_at: row.created_at },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

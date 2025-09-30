
/* @ts-nocheck */
// app/api/round/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

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
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
    );
  }

  const { data: row, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }
  if (!row) {
    return NextResponse.json(
      { id: null, phase: 'setup', speed_ms: 800, called: [], created_at: null },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
    );
  }

  return NextResponse.json(
    { id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called, created_at: row.created_at },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
  );
}

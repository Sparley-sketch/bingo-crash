/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/round/force-end?setup=1
 * Ends ANY rows whose phase normalizes to 'live' (trim/lower on server side).
 * Optionally inserts a fresh 'setup' row.
 * Returns diagnostics incl. which IDs were ended.
 */
export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // 1) Pull recent rounds (pull more if your table is large)
  const { data: rows, error: selErr } = await supabase
    .from('rounds')
    .select('id, phase, created_at')
    .order('created_at', { ascending: false })
    .limit(1000);

  if (selErr) {
    return NextResponse.json({ error: selErr.message }, { status: 500 });
  }

  // 2) Normalize phases client-side and collect LIVE-ish IDs
  const liveIds: string[] =
    (rows || [])
      .filter(r => String(r.phase || '').trim().toLowerCase() === 'live')
      .map(r => r.id);

  let ended = 0;
  if (liveIds.length) {
    const { error: upErr } = await supabase
      .from('rounds')
      .update({ phase: 'ended' })
      .in('id', liveIds);
    if (upErr) {
      return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
    ended = liveIds.length;
  }

  // 3) Optional fresh setup
  const url = new URL(req.url);
  let insertedSetup: null | { id: string } = null;
  if (url.searchParams.get('setup') === '1') {
    const { data: ins, error: insErr } = await supabase
      .from('rounds')
      .insert([{ phase: 'setup', speed_ms: 800, deck: [], called: [] }])
      .select('id')
      .single();
    if (!insErr && ins) insertedSetup = ins;
  }

  // 4) Report what the server sees now
  const { data: liveNow } = await supabase
    .from('rounds')
    .select('id, phase, created_at')
    .eq('phase', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newest } = await supabase
    .from('rounds')
    .select('id, phase, created_at')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host } catch { return process.env.NEXT_PUBLIC_SUPABASE_URL! } })();

  return NextResponse.json({
    env: { supabase_host: host, service_key_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.length) },
    ended_ids: liveIds,
    inserted_setup: insertedSetup,
    live_round_after: liveNow || null,
    newest_round_after: newest || null,
    now: new Date().toISOString(),
  }, { headers: { 'Cache-Control': 'no-store' } });
}

/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x:any){ return String(x ?? '').trim().toLowerCase(); }

export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows } = await supabase.from('rounds').select('id,phase,created_at').order('created_at',{ascending:false}).limit(1000);
  const liveIds = (rows || []).filter(r => normPhase(r.phase) === 'live').map(r => r.id);

  let ended = 0;
  if (liveIds.length) {
    const { error: upErr } = await supabase.from('rounds').update({ phase: 'ended' }).in('id', liveIds);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    ended = liveIds.length;
  }

  const url = new URL(req.url);
  let inserted_setup = null;
  if (url.searchParams.get('setup') === '1') {
    const { data: ins } = await supabase.from('rounds').insert([{ phase: 'setup', speed_ms: 800, deck: [], called: [] }]).select('id').single();
    inserted_setup = ins || null;
  }

  const { data: newest } = await supabase.from('rounds').select('id,phase,created_at').order('created_at',{ascending:false}).limit(1).maybeSingle();

  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host } catch { return process.env.NEXT_PUBLIC_SUPABASE_URL! } })();
  return NextResponse.json(
    { env: { supabase_host: host, service_key_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.length) }, ended_ids: liveIds, inserted_setup, newest_round_after: newest || null, now: new Date().toISOString() },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { resetRound, getRound } from '../../_lib/roundStore';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x:any){ return String(x ?? '').trim().toLowerCase(); }

async function readSpeed(supabase:any){
  try {
    const { data } = await supabase.from('config').select('value').eq('key','round.duration_ms').maybeSingle();
    const n = Number(data?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {}
  return 800;
}

export async function POST() {
  resetRound();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows } = await supabase.from('rounds').select('id,phase').order('created_at',{ascending:false}).limit(1000);
  const liveIds = (rows || []).filter(r => normPhase(r.phase) === 'live').map(r => r.id);
  if (liveIds.length) {
    const { error: upErr } = await supabase.from('rounds').update({ phase: 'ended' }).in('id', liveIds);
    if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const speed_ms = await readSpeed(supabase);
  const { data: ins, error: insErr } = await supabase
    .from('rounds')
    .insert([{ phase: 'setup', speed_ms, deck: [], called: [] }])
    .select('*').single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json(
    { id: ins.id, phase: 'setup', speed_ms: ins.speed_ms ?? speed_ms, called: ins.called ??, ok: true, id: getRound().id [] },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shuffle(a:number[]){for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]}return a;}
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
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // return existing live if present
  {
    const { data: rows } = await supabase
      .from('rounds').select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    const live = (rows || []).find(r => normPhase(r.phase) === 'live');
    if (live) {
      return NextResponse.json(
        { id: live.id, phase: 'live', speed_ms: live.speed_ms ?? 800, called: live.called ?? [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  // end stragglers
  {
    const { data: rows } = await supabase
      .from('rounds').select('id,phase').order('created_at', { ascending: false }).limit(1000);
    const liveIds = (rows || []).filter(r => normPhase(r.phase) === 'live').map(r => r.id);
    if (liveIds.length) {
      const { error: upErr } = await supabase.from('rounds').update({ phase: 'ended' }).in('id', liveIds);
      if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });
    }
  }

  const speed_ms = await readSpeed(supabase);
  const deck = shuffle(Array.from({ length: 25 }, (_, i) => i + 1));
  const { data: row, error } = await supabase
    .from('rounds')
    .insert([{ phase: 'live', speed_ms, deck, called: [] }])
    .select('*').single();

  if (!error && row) {
    return NextResponse.json(
      { id: row.id, phase: 'live', speed_ms: row.speed_ms ?? speed_ms, called: row.called ?? [] },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  if (error?.code === '23505' || /duplicate key/.test(String(error?.message||''))) {
    const { data: rows2 } = await supabase
      .from('rounds').select('*').order('created_at',{ascending:false}).limit(50);
    const live2 = (rows2 || []).find(r => normPhase(r.phase) === 'live');
    if (live2) {
      return NextResponse.json(
        { id: live2.id, phase: 'live', speed_ms: live2.speed_ms ?? speed_ms, called: live2.called ?? [] },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }
  }

  return NextResponse.json({ error: `round insert failed: ${error?.message || 'unknown'}` }, { status: 500 });
}

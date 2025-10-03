// app/api/round/out/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic'; export const revalidate = 0;

function admin(){ return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession:false } }
);}
function nocache(){ return { 'cache-control':'no-store', pragma:'no-cache', expires:'0',
  'content-type':'application/json; charset=utf-8' }; }

export async function POST(req: Request) {
  const supabase = admin();
  const { alias } = await req.json().catch(()=>({}));
  if (!alias) return NextResponse.json({ ok:false, error:'alias-required' }, { status:400, headers:nocache() });

  // newest round
  const { data: round } = await supabase
    .from('rounds')
    .select('id, phase, called')
    .order('created_at', { ascending:false })
    .limit(1)
    .maybeSingle();

  if (!round) return NextResponse.json({ ok:false, error:'no-round' }, { status:409, headers:nocache() });

  const r:any = round;
  const calls = Array.isArray(r.called) ? r.called.length : 0;
  if (calls === 0) {
    // ignore early reports (no ball called yet)
    return NextResponse.json({ ok:false, ignored:true, reason:'no-progress' }, { status:200, headers:nocache() });
  }

  // mark player as out
  const { error: upErr } = await supabase
    .from('round_players')
    .update({ out_at: new Date().toISOString() })
    .eq('round_id', r.id)
    .eq('alias', alias);

  if (upErr) return NextResponse.json({ ok:false, error: upErr.message }, { status:500, headers:nocache() });

  // compute if all joined players are now out
  const { data: counts, error: cErr } = await supabase
    .rpc('round_players_counts', { rid: r.id }) // optional RPC (see below), or do two selects
  ;

  // If you don't want a RPC, do it inline:
  // const { data: joined } = await supabase.from('round_players').select('id').eq('round_id', r.id);
  // const { data: outs }   = await supabase.from('round_players').select('id').eq('round_id', r.id).not('out_at','is', null);
  // const allOut = (joined?.length || 0) > 0 && (joined?.length === (outs?.length || 0));

  const allOut = counts ? counts.all_out === true : false;

  return NextResponse.json({ ok:true, round_id: r.id, phase: r.phase, calls, allOut }, { status:200, headers:nocache() });
}

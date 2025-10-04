// app/api/round/join/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const dynamic = 'force-dynamic'; export const revalidate = 0;
import { getRound } from '../../_lib/roundStore';

function admin() { return createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);}

function nocache(){ return { 'cache-control':'no-store', pragma:'no-cache', expires:'0',
  'content-type':'application/json; charset=utf-8' }; }

export async function POST(req: Request) {
  const supabase = admin();
  const { alias } = await req.json().catch(()=>({}));
  if (!alias) return NextResponse.json({ ok:false, error:'alias-required' }, { status:400, headers:nocache() });

  const { data: round } = await supabase
    .from('rounds')
    .select('id, phase')
    .order('created_at', { ascending:false })
    .limit(1)
    .maybeSingle();

  if (!round) return NextResponse.json({ ok:false, error:'no-round' }, { status:409, headers:nocache() });

  // upsert player for this round
  const { error } = await supabase
    .from('round_players')
    .upsert({ round_id: (round as any).id, alias }, { onConflict: 'round_id,alias' });

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status:500, headers:nocache() });
  return NextResponse.json({ ok:true, round_id:(round as any).id, phase:(round as any).phase }, { status:200, headers:nocache() });
}
export async function POST(req: Request) {
  const { alias } = await req.json().catch(() => ({}));
  if (!alias) return new NextResponse('alias required', { status: 400 });

  const r = getRound();
  if (!r.players[alias]) r.players[alias] = { alias, cards: [] };

  return NextResponse.json({ ok: true });
}
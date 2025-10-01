/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x:any){ return String(x ?? '').trim().toLowerCase(); }

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from('rounds').select('*')
    .order('created_at', { ascending: false }).limit(50);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const live = (rows || []).find(r => normPhase(r.phase) === 'live');
  if (!live) return NextResponse.json({ error: 'No live round' }, { status: 400 });

  const deck: number[] = Array.isArray(live.deck) ? live.deck : [];
  const called: number[] = Array.isArray(live.called) ? live.called : [];

  if (deck.length === 0) {
    const { error: upEndErr } = await supabase.from('rounds').update({ phase: 'ended' }).eq('id', live.id);
    if (upEndErr) return NextResponse.json({ error: upEndErr.message }, { status: 500 });
    return NextResponse.json({ ended: true, called }, { headers: { 'Cache-Control': 'no-store' } });
  }

  const n = deck[0];
  const nextDeck = deck.slice(1);
  const nextCalled = [...called, n];

  const { data: upd, error: upErr } = await supabase
    .from('rounds')
    .update({ deck: nextDeck, called: nextCalled })
    .eq('id', live.id)
    .select('*').single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json(
    { n, called: upd.called, remaining: upd.deck?.length ?? nextDeck.length },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

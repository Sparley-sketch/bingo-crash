import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export async function POST() {
  // Require session + admin
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, key);

  // Latest round
  const { data: round, error: rdErr } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  if (rdErr) return NextResponse.json({ error: rdErr.message }, { status: 500 });
  if (!round || round.phase !== 'live') return NextResponse.json({ error: 'No live round' }, { status: 400 });

  const deck: number[] = round.deck || [];
  const called: number[] = round.called || [];
  if (deck.length === 0) {
    await supabase.from('rounds').update({ phase: 'ended' }).eq('id', round.id);
    return NextResponse.json({ ended: true, called });
  }

  const n = deck[0];
  const nextDeck = deck.slice(1);
  const nextCalled = [...called, n];

  const { data: upd, error: upErr } = await supabase
    .from('rounds')
    .update({ deck: nextDeck, called: nextCalled })
    .eq('id', round.id)
    .select('*')
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ n, called: upd.called, remaining: upd.deck.length });
}

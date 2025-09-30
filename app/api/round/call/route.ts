import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  // admin-only (same check as start)
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // latest round
  const { data: round, error: rdErr } = await supabase
    .from('rounds').select('*')
    .order('created_at',{ascending:false}).limit(1).single();
  if (rdErr) return NextResponse.json({ error: rdErr.message }, { status: 500 });
  if (!round || round.phase !== 'live') return NextResponse.json({ error: 'No live round' }, { status: 400 });

  const deck: number[] = round.deck || [];
  const called: number[] = round.called || [];
  if (deck.length === 0) {
    await supabase.from('rounds').update({ phase: 'ended' }).eq('id', round.id);
    return NextResponse.json({ ended: true, called });
  }

  const n = deck[0];
  const { data: upd, error: upErr } = await supabase
    .from('rounds')
    .update({ deck: deck.slice(1), called: [...called, n] })
    .eq('id', round.id).select('*').single();
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ n, called: upd.called, remaining: upd.deck.length });
}

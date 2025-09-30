/* @ts-nocheck */
// app/api/round/call/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  // --- 1) Require signed-in admin (RLS-safe check via helper) ---
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me, error: meErr } = await helper
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();

  if (meErr) return NextResponse.json({ error: `profiles select failed: ${meErr.message}` }, { status: 400 });
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  // --- 2) Service-role client for writes (bypass RLS on server) ---
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // --- 3) Pick the latest LIVE round (not just the newest row) ---
  const { data: live, error: rdErr } = await supabase
    .from('rounds')
    .select('*')
    .eq('phase', 'live')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (rdErr) return NextResponse.json({ error: rdErr.message }, { status: 500 });
  if (!live)  return NextResponse.json({ error: 'No live round' }, { status: 400 });

  const deck: number[]   = Array.isArray(live.deck)   ? live.deck   : [];
  const called: number[] = Array.isArray(live.called) ? live.called : [];

  // --- 4) If deck empty, mark round ended ---
  if (deck.length === 0) {
    const { error: upEndErr } = await supabase
      .from('rounds')
      .update({ phase: 'ended' })
      .eq('id', live.id);

    if (upEndErr) return NextResponse.json({ error: upEndErr.message }, { status: 500 });
    return NextResponse.json({ ended: true, called }, { headers: { 'Cache-Control': 'no-store' } });
  }

  // --- 5) Pop next number and persist ---
  const n = deck[0];
  const nextDeck = deck.slice(1);
  const nextCalled = [...called, n];

  const { data: upd, error: upErr } = await supabase
    .from('rounds')
    .update({ deck: nextDeck, called: nextCalled })
    .eq('id', live.id)
    .select('*')
    .single();

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json(
    { n, called: upd.called, remaining: upd.deck?.length ?? 0 },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

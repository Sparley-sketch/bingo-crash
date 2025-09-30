/* @ts-nocheck */
// app/api/round/start/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function shuffle(a: number[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

async function readConfigSpeed(supabase: any): Promise<number> {
  try {
    const { data } = await supabase.from('config').select('value').eq('key', 'round.duration_ms').maybeSingle();
    const n = Number(data?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) return n;
  } catch {}
  return 800;
}

export async function POST() {
  // RLS-safe: require signed-in admin
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // End any existing live rounds to avoid duplicates
  await supabase.from('rounds').update({ phase: 'ended' }).eq('phase', 'live');

  const speed_ms = await readConfigSpeed(supabase);
  const deck = shuffle(Array.from({ length: 25 }, (_, i) => i + 1));

  const { data: row, error } = await supabase
    .from('rounds')
    .insert([{ phase: 'live', speed_ms, deck, called: [] }])
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: `round insert failed: ${error.message}` }, { status: 500 });

  return NextResponse.json(
    { id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
  );
}

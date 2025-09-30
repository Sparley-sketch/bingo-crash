/* @ts-nocheck */
// app/api/round/reset/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  // Always end any live rounds first
  await supabase.from('rounds').update({ phase: 'ended' }).eq('phase', 'live');

  // Insert a fresh SETUP round
  const speed_ms = await readConfigSpeed(supabase);
  const { data: inserted, error: insErr } = await supabase
    .from('rounds')
    .insert([{ phase: 'setup', speed_ms, deck: [], called: [] }])
    .select('*')
    .single();

  if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });

  return NextResponse.json(
    { id: inserted.id, phase: inserted.phase, speed_ms: inserted.speed_ms, called: inserted.called },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
  );
}

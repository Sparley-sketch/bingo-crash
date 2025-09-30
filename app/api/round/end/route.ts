/* @ts-nocheck */
// app/api/round/end/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  // RLS-safe: require signed-in admin
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  // Service role for writes
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

  // End ALL live rounds to avoid stuck state
  const { data: lives, error: readErr } = await supabase
    .from('rounds')
    .select('id')
    .eq('phase', 'live');

  if (readErr) return NextResponse.json({ error: readErr.message }, { status: 500 });

  if (!lives || lives.length === 0) {
    return NextResponse.json({ ended: 0 }, { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } });
  }

  const ids = lives.map((r: any) => r.id);
  const { error: upErr } = await supabase
    .from('rounds')
    .update({ phase: 'ended' })
    .in('id', ids);

  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json(
    { ended: ids.length },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
  );
}

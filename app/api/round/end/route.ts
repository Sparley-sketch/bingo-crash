
/* @ts-nocheck */
// app/api/round/end/route.ts
import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST() {
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);

const { data: lives } = await supabase
  .from('rounds')
  .select('id')
  .ilike('phase', '%live%');       // was 'live%'

if (lives?.length) {
  const ids = lives.map((r:any) => r.id);
  await supabase.from('rounds').update({ phase: 'ended' }).in('id', ids);
}

  if (!lives?.length) return NextResponse.json({ ended: 0 }, { headers:{'Cache-Control':'no-store'} });

  const ids = lives.map((r:any) => r.id);
  const { error: upErr } = await supabase.from('rounds').update({ phase: 'ended' }).in('id', ids);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ended: ids.length }, { headers:{'Cache-Control':'no-store'} });
}

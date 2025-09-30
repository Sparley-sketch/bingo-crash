import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

function shuffle(a: number[]) { for (let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]]} return a; }

export async function POST() {
  // 1) Must be signed in and admin
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session }, error: sErr } = await helper.auth.getSession();
  if (sErr) return NextResponse.json({ error: `auth.getSession: ${sErr.message}` }, { status: 400 });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: me, error: meErr } = await helper
    .from('profiles').select('id, role').eq('id', session.user.id).single();
  if (meErr) return NextResponse.json({ error: `profiles select failed: ${meErr.message}` }, { status: 400 });
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  // 2) Service-role client (writes bypass RLS on the server)
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, svc);

  // 3) Optional: read speed from config (safe if table missing)
  let speed_ms = 800;
  try {
    const { data: cfg } = await supabase.from('config').select('value')
      .eq('key','round.duration_ms').maybeSingle();
    const n = Number(cfg?.value); if (Number.isFinite(n) && n>=100 && n<=5000) speed_ms = n;
  } catch {}

  // 4) Create a LIVE round with a fresh deck
  const deck = shuffle(Array.from({ length: 25 }, (_, i) => i + 1));
  const { data: row, error } = await supabase
    .from('rounds')
    .insert({ phase: 'live', speed_ms, deck, called: [] })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: `round insert failed: ${error.message}` }, { status: 500 });
  return NextResponse.json({ id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called });
}

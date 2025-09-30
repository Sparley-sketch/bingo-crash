import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

function shuffle(a: number[]) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

  const deck = shuffle(Array.from({ length: 25 }, (_, i) => i + 1));

  // Optionally read your config table for duration_ms and put it into speed_ms
  let speed_ms = 800;
  const { data: cfg } = await supabase.from('config').select('value').eq('key','round.duration_ms').maybeSingle();
  const raw = typeof cfg?.value === 'number' ? cfg.value : Number(cfg?.value);
  if (Number.isFinite(raw) && raw >= 100 && raw <= 5000) speed_ms = raw;

  const { data: row, error } = await supabase
    .from('rounds')
    .insert({ phase: 'live', speed_ms, deck, called: [] })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called });
}

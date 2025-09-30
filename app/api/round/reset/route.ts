import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function POST() {
  // Admin check via RLS-safe helper
  const helper = createRouteHandlerClient({ cookies });
  const { data: { session } } = await helper.auth.getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const { data: me } = await helper.from('profiles').select('role').eq('id', session.user.id).single();
  if (!me || me.role !== 'admin') return NextResponse.json({ error: 'Forbidden (need admin)' }, { status: 403 });

  // Service client for writes
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc  = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, svc);

  // Optional: read speed from config (safe if table missing)
  let speed_ms = 800;
  try {
    const { data: cfg } = await supabase.from('config').select('value').eq('key','round.duration_ms').maybeSingle();
    const n = Number(cfg?.value);
    if (Number.isFinite(n) && n >= 100 && n <= 5000) speed_ms = n;
  } catch {}

  // New "setup" row becomes the latest round
  const { data: row, error } = await supabase
    .from('rounds')
    .insert({ phase: 'setup', speed_ms, deck: [], called: [] })
    .select('*')
    .single();

  if (error) return NextResponse.json({ error: `reset failed: ${error.message}` }, { status: 500 });
  return NextResponse.json({ id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called });
}

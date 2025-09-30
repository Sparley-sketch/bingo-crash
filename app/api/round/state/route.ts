// app/api/round/state/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
  const supabase = createClient(url, key);

  const { data: row, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (!row) {
    const { data: inserted, error: insErr } = await supabase
      .from('rounds')
      .insert({ phase: 'setup', speed_ms: 800, deck: [], called: [] })
      .select('*')
      .single();

    if (insErr) {
      return NextResponse.json({ error: insErr.message }, { status: 500 });
    }

    return NextResponse.json(
      { id: inserted.id, phase: inserted.phase, speed_ms: inserted.speed_ms, called: inserted.called, created_at: inserted.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { id: row.id, phase: row.phase, speed_ms: row.speed_ms, called: row.called, created_at: row.created_at },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

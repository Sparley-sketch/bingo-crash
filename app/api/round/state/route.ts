import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET() {
  const url  = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key  = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-only
  const supabase = createClient(url, key);

  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (!data) {
    // create a default setup row if none exists
    const { data: ins, error: insErr } = await supabase
      .from('rounds')
      .insert({ phase: 'setup', speed_ms: 800, deck: [], called: [] })
      .select('*')
      .single();
    if (insErr) return NextResponse.json({ error: insErr.message }, { status: 500 });
    return NextResponse.json({ id: ins.id, phase: ins.phase, speed_ms: ins.speed_ms, called: ins.called, created_at: ins.created_at }, { headers: { 'Cache-Control': 'no-store' } });
  }

  return NextResponse.json({ id: data.id, phase: data.phase, speed_ms: data.speed_ms, called: data.called, created_at: data.created_at }, { headers: { 'Cache-Control': 'no-store' } });
}

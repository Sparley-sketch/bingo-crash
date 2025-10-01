/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x:any){ return String(x ?? '').trim().toLowerCase(); }

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500, headers: { 'Cache-Control': 'no-store' } });
  }

  const live = (rows || []).find(r => normPhase(r.phase) === 'live');
  if (live) {
    return NextResponse.json(
      { id: live.id, phase: 'live', speed_ms: live.speed_ms ?? 800, called: live.called ?? [], created_at: live.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const newest = (rows || [])[0];
  if (newest) {
    return NextResponse.json(
      { id: newest.id, phase: normPhase(newest.phase), speed_ms: newest.speed_ms ?? 800, called: newest.called ?? [], created_at: newest.created_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  return NextResponse.json(
    { id: null, phase: 'setup', speed_ms: 800, called: [], created_at: null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

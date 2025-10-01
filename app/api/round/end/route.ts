/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x:any){ return String(x ?? '').trim().toLowerCase(); }

export async function POST() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from('rounds').select('id,phase').order('created_at', { ascending: false }).limit(1000);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const liveIds = (rows || []).filter(r => normPhase(r.phase) === 'live').map(r => r.id);
  if (!liveIds.length) return NextResponse.json({ ended: 0 }, { headers: { 'Cache-Control': 'no-store' } });

  const { error: upErr } = await supabase.from('rounds').update({ phase: 'ended' }).in('id', liveIds);
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 });

  return NextResponse.json({ ended: liveIds.length }, { headers: { 'Cache-Control': 'no-store' } });
}

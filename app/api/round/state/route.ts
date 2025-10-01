/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime     = 'nodejs';
export const dynamic     = 'force-dynamic';        // never pre-render
export const revalidate  = 0;                      // no ISR
export const fetchCache  = 'force-no-store';       // Next.js fetch: no cache
export const preferredRegion = 'home';

function norm(x:any){ return String(x ?? '').trim().toLowerCase(); }

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: rows, error } = await supabase
    .from('rounds').select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message, at: 'state' },
      { status: 500, headers: { 'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate' } }
    );
  }

  const list  = rows || [];
  const live  = list.find(r => norm(r.phase) === 'live');
  const row   = live ?? list[0];
  const body  = row
    ? { id: row.id, phase: norm(row.phase), speed_ms: row.speed_ms ?? 800, called: Array.isArray(row.called) ? row.called : [], created_at: row.created_at, ts: Date.now() }
    : { id: null, phase: 'setup', speed_ms: 800, called: [], created_at: null, ts: Date.now() };

  return NextResponse.json(
    body,
    {
      headers: {
        // kill CDN/browser caches
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate',
        // handy for debugging freshness
        'x-state-ts': String(Date.now()),
      },
    }
  );
}

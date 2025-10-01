/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function normPhase(x: any) {
  return String(x ?? '').trim().toLowerCase();
}

/**
 * Returns the authoritative round state for the client.
 * - Prefers the latest row whose normalized phase is 'live'
 * - Otherwise returns the newest row (setup/ended)
 * - If there are no rows, returns a synthetic setup state (does not insert)
 */
export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Read newest ~100 rows and normalize phases in JS (tolerates spaces/casing)
  const { data: rows, error } = await supabase
    .from('rounds')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const list = rows || [];
  const live = list.find(r => normPhase(r.phase) === 'live');
  if (live) {
    return NextResponse.json(
      {
        id: live.id,
        phase: 'live',
        speed_ms: live.speed_ms ?? 800,
        called: Array.isArray(live.called) ? live.called : [],
        created_at: live.created_at,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
    );
  }

  const newest = list[0];
  if (newest) {
    return NextResponse.json(
      {
        id: newest.id,
        phase: normPhase(newest.phase),
        speed_ms: newest.speed_ms ?? 800,
        called: Array.isArray(newest.called) ? newest.called : [],
        created_at: newest.created_at,
      },
      { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
    );
  }

  // No rows at all: return a synthetic setup (do not insert from here)
  return NextResponse.json(
    {
      id: null,
      phase: 'setup',
      speed_ms: 800,
      called: [],
      created_at: null,
    },
    { headers: { 'Cache-Control': 'no-store, no-cache, max-age=0' } }
  );
}

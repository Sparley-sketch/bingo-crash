/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/round/force-end?setup=1
 * Ends any live-like rows (case/space tolerant). If ?setup=1, inserts a fresh setup row.
 * Returns a diagnostic payload so you can see what the server sees.
 */
export async function GET(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Normalize and end any live variants (e.g., 'Live', 'live ')
  await supabase.from('rounds').update({ phase: 'ended' }).ilike('phase', 'live%');

  // Optionally insert fresh setup
  const url = new URL(req.url);
  if (url.searchParams.get('setup') === '1') {
    await supabase
      .from('rounds')
      .insert([{ phase: 'setup', speed_ms: 800, deck: [], called: [] }]);
  }

  const { data: live } = await supabase
    .from('rounds')
    .select('id, phase, created_at, called')
    .ilike('phase', 'live%')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: newest } = await supabase
    .from('rounds')
    .select('id, phase, created_at, called')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const host = (() => { try { return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).host } catch { return process.env.NEXT_PUBLIC_SUPABASE_URL! } })();

  return NextResponse.json(
    {
      env: { supabase_host: host, service_key_present: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY?.length) },
      live_round: live || null,
      newest_round: newest || null,
      now: new Date().toISOString(),
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

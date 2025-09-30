
/* @ts-nocheck */
// app/api/debug/round/route.ts  (TEMPORARY)
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const svc = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  const supabase = createClient(url, svc);
  const host = (() => { try { return new URL(url).host } catch { return url } })();

  const { data: live } = await supabase
    .from('rounds')
    .select('id, phase, created_at, called')
    .eq('phase','live')
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  const { data: newest } = await supabase
    .from('rounds')
    .select('id, phase, created_at, called')
    .order('created_at',{ascending:false})
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    env: { supabase_host: host, service_key_present: Boolean(svc && svc.length >= 20) },
    live_round: live || null,
    newest_round: newest || null,
    now: new Date().toISOString(),
  }, { headers:{'Cache-Control':'no-store'} });
}

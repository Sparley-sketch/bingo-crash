/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const key = url.searchParams.get('key') || 'round.duration_ms';

  const { data, error } = await supabaseAdmin
    .from(tableNames.config)
    .select('value, updated_at')
    .eq('key', key)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { key, value: data?.value ?? null, updated_at: data?.updated_at ?? null },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

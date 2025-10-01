/* @ts-nocheck */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const body = await req.json().catch(() => ({}));
  const key  = String(body?.key ?? 'round.duration_ms');
  const valRaw = String(body?.value ?? '1500');

  // Normalize to integer milliseconds (100..5000 guard, adjust as you like)
  let value = parseInt(valRaw, 10);
  if (!Number.isFinite(value)) value = 1500;
  value = Math.max(100, Math.min(5000, value));

  const { data, error } = await supabase
    .from('config')
    .upsert({ key, value })
    .select('key,value,updated_at')
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(
    { key: data.key, value: data.value, updated_at: data.updated_at },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

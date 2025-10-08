import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const key = String(body?.key ?? 'round.duration_ms');
    const valRaw = String(body?.value ?? '1500');

    // Normalize to integer milliseconds (100..10000 guard, adjust as you like)
    let value = parseInt(valRaw, 10);
    if (!Number.isFinite(value)) value = 800;
    value = Math.max(100, Math.min(10000, value));

    const { data, error } = await supabaseAdmin
      .from(tableNames.config)
      .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' })
      .select('key,value,updated_at')
      .single();

    if (error) {
      console.error('Error saving config:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(
      { key: data.key, value: data.value, updated_at: data.updated_at },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Unexpected error in config/set endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

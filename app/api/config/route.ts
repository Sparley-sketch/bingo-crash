import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

const PUTSchema = z.object({
  key: z.string().min(1),
  value: z.any()
});

const ADMIN_SECRET = process.env.ADMIN_SECRET;

export async function GET() {
  const { data, error } = await supabaseAdmin.from('config').select('*').order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data || [] });
}

export async function PUT(req: NextRequest) {
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: 'Server missing ADMIN_SECRET' }, { status: 500 });
  }
  const headerSecret = req.headers.get('x-admin-secret');
  if (headerSecret !== ADMIN_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const json = await req.json();
  const parsed = PUTSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { key, value } = parsed.data;
  const { error } = await supabaseAdmin
    .from('config')
    .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: 'key' });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const { data: items, error: e2 } = await supabaseAdmin.from('config').select('*').order('key');
  if (e2) return NextResponse.json({ error: e2.message }, { status: 500 });
  return NextResponse.json({ ok: true, items });
}

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const POSTSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['admin', 'viewer']).default('viewer'),
});

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) throw new Error('Missing Supabase env vars');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function requireAdmin() {
  const supabase = createRouteHandlerClient({ cookies });
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return { error: 'Unauthorized', status: 401 } as const;
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .single();
  if (!profile || profile.role !== 'admin') {
    return { error: 'Forbidden', status: 403 } as const;
  }
  return { ok: true } as const;
}

export async function POST(req: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const parsed = POSTSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, password, role } = parsed.data;

  const admin = getAdminClient();

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  const userId = data.user?.id;
  if (!userId) return NextResponse.json({ error: 'User creation returned no id' }, { status: 500 });

  const { error: pErr } = await admin.from('profiles').upsert({ id: userId, email, role, force_password_change: true });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, user_id: userId, email, role });
}

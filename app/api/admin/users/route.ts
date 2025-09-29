// app/api/admin/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { createClient } from '@supabase/supabase-js';

const POSTSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6).optional(),   // used if sendInvite=false
  role: z.enum(['admin', 'viewer']).default('viewer'),
  sendInvite: z.boolean().default(true),
});

const PATCHSchema = z.object({
  email: z.string().email().optional(),
  user_id: z.string().uuid().optional(),
  role: z.enum(['admin', 'viewer']),
}).refine(d => d.email || d.user_id, { message: 'Provide email or user_id' });

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

// Ensure caller is logged-in AND has role='admin'
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
  const { email, password, role, sendInvite } = parsed.data;

  const admin = getAdminClient();

  // 1) Create/invite the user via Admin API
  let userId: string | null = null;
  if (sendInvite) {
    // Sends an email invite (SMTP must be configured in Supabase Auth → SMTP)
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    userId = data.user?.id ?? null;
  } else {
    // Direct create with a password (email marked confirmed)
    const { data, error } = await admin.auth.admin.createUser({
      email,
      password: password || crypto.randomUUID().slice(0, 12),
      email_confirm: true,
    });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    userId = data.user?.id ?? null;
  }
  if (!userId) return NextResponse.json({ error: 'User creation returned no id' }, { status: 500 });

  // 2) Upsert role in profiles
  const { error: pErr } = await admin
    .from('profiles')
    .upsert({ id: userId, email, role });
  if (pErr) return NextResponse.json({ error: pErr.message }, { status: 400 });

  return NextResponse.json({ ok: true, user_id: userId, email, role });
}

export async function PATCH(req: NextRequest) {
  const gate = await requireAdmin();
  if ('error' in gate) return NextResponse.json({ error: gate.error }, { status: gate.status });

  const body = await req.json();
  const parsed = PATCHSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }
  const { email, user_id, role } = parsed.data;
  const admin = getAdminClient();

  let id = user_id ?? null;
  if (!id && email) {
    // Look up by email (Admin listUsers)
    const { data, error } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    const found = data.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (!found) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    id = found.id;
  }

  const { error } = await admin.from('profiles').upsert({ id: id!, email: email ?? undefined, role });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, user_id: id, role });
}

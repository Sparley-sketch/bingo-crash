import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRound } from '../../_lib/roundStore';

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server-side key
  return createClient(url, key, { auth: { persistSession: false } });
}

// GET /api/round/winner?round_id=...
// Returns { alias, daubs } for the highest daubs (ties resolved by earliest submission)
export async function GET(req: NextRequest) {
  const round_id = req.nextUrl.searchParams.get('round_id');
  if (!round_id) return NextResponse.json({}, { status: 200 });

  const supabase = serverClient();
  const { data, error } = await supabase
    .from('round_scores')
    .select('alias, daubs, created_at')
    .eq('round_id', round_id)
    .order('daubs', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data || !data.length) return NextResponse.json({}, { status: 200 });

  const top = data[0];
  return NextResponse.json({ alias: top.alias, daubs: top.daubs }, { status: 200 });
}

// POST /api/round/winner  body: { round_id, alias, daubs }
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const round_id = body?.round_id as string | undefined;
  const alias    = (body?.alias ?? '').toString().slice(0, 64);
  const daubs    = Number(body?.daubs ?? 0) | 0;

  if (!round_id || !alias) return NextResponse.json({ ok: false }, { status: 200 });

  const supabase = serverClient();
  const { error } = await supabase
    .from('round_scores')
    .upsert({ round_id, alias, daubs, updated_at: new Date().toISOString() });

  if (error) return NextResponse.json({ ok:false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok:true }, { status: 200 });
}
export async function POST(req: Request) {
  const r = getRound();
  if (r.phase !== 'ended') return new NextResponse('round not ended', { status: 409 });

  const { alias, daubs } = await req.json().catch(() => ({}));
  if (alias && typeof daubs === 'number') {
    r.winner = { alias, daubs }; // optional: reconcile vs computed winner
  }
  return NextResponse.json({ ok: true, winner: r.winner });
}

// Optional: allow GET to read winner (used by client to sync popup)
export async function GET() {
  const r = getRound();
  return NextResponse.json(r.winner ?? null);
}
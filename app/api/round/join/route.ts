import { NextResponse } from 'next/server';
import { getRound } from '../../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { alias } = await req.json().catch(() => ({}));
  if (!alias) return new NextResponse('alias required', { status: 400 });

  const r = getRound();
  if (!r.players[alias]) r.players[alias] = { alias, cards: [] };
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
}

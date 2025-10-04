import { NextResponse } from 'next/server';
import { getRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { alias } = await req.json().catch(() => ({}));
  const r = getRound();
  if (!alias || !r.players[alias]) return new NextResponse('unknown alias', { status: 400 });
  r.players[alias].postedOut = true; // telemetry only; DO NOT end the round here
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
}

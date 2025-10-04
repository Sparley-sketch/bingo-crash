import { NextResponse } from 'next/server';
import { getRound } from '../../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const r = getRound();
  if (r.phase !== 'ended') return new NextResponse('round not ended', { status: 409 });

  const { alias, daubs } = await req.json().catch(() => ({}));
  if (alias && typeof daubs === 'number') {
    r.winner = { alias, daubs };
  }
  return NextResponse.json({ ok: true, winner: r.winner }, { headers: { 'Cache-Control': 'no-store' }});
}

export async function GET() {
  const r = getRound();
  return NextResponse.json(r.winner ?? null, { headers: { 'Cache-Control': 'no-store' }});
}

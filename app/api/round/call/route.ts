import { NextResponse } from 'next/server';
import { getRound, applyCallServerSide, maybeEndRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const r = getRound();
  if (r.phase !== 'live') return new NextResponse('not live', { status: 409 });

  const { n } = await req.json().catch(() => ({}));
  if (typeof n !== 'number') return new NextResponse('n required', { status: 400 });

  if (!r.called.includes(n)) {
    r.called.push(n);
    applyCallServerSide(n, r);
    maybeEndRound(r); // only ends when global live cards == 0 or deck exhausted
  }

  return NextResponse.json({ ok: true, called: r.called.length }, { headers: { 'Cache-Control': 'no-store' }});
}

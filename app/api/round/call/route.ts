import { NextResponse } from 'next/server';
import { getRound, applyCallServerSide, maybeEndRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const r = getRound();
  if (r.phase !== 'live') return new NextResponse('not live', { status: 409 });

  let n: number;
  try {
    const body = await req.json();
    n = body.n;
  } catch {
    // If no body or invalid JSON, generate a random number
    n = Math.floor(Math.random() * 25) + 1;
  }

  // If no number provided or invalid, generate a random number
  if (typeof n !== 'number' || n < 1 || n > 25) {
    n = Math.floor(Math.random() * 25) + 1;
  }

  if (!r.called.includes(n)) {
    r.called.push(n);
    applyCallServerSide(n, r);
    maybeEndRound(r); // only ends when global live cards == 0
  }

  return NextResponse.json({ ok: true, called: r.called.length, number: n }, { headers: { 'Cache-Control': 'no-store' }});
}

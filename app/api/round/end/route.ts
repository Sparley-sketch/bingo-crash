import { NextResponse } from 'next/server';
import { getRound, computeWinner } from '../../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST() {
  const r = getRound();
  if (r.phase === 'live') {
    r.phase = 'ended';
    r.ended_at = Date.now();
    r.winner = computeWinner(r);
  }
  return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
}

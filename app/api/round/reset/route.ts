import { NextResponse } from 'next/server';
import { resetRound, getRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST() {
  resetRound();
  const r = getRound();
  return NextResponse.json({ ok: true, id: r.id, phase: r.phase, speed_ms: r.speed_ms, called: r.called },
    { headers: { 'Cache-Control': 'no-store' }});
}

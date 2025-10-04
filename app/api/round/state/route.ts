import { NextResponse } from 'next/server';
import { getRound, recomputeLiveCardsCount } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = getRound();
  const live = recomputeLiveCardsCount(r);
  return NextResponse.json({
    id: r.id,
    phase: r.phase,
    called: r.called,
    speed_ms: r.speed_ms,
    live_cards_count: live
  }, { headers: { 'Cache-Control': 'no-store' }});
}

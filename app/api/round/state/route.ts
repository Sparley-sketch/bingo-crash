import { NextResponse } from 'next/server';
import { getRound, recomputeLiveCardsCount, maybeEndRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function GET() {
  const r = getRound();
  
  // Check if game should end (when live cards = 0)
  maybeEndRound(r);
  
  const live = recomputeLiveCardsCount(r);
  const playerCount = Object.keys(r.players).length;
  console.log(`State endpoint: phase=${r.phase}, live_cards=${live}, players=${playerCount}, called=${r.called.length}`);
  
  return NextResponse.json({
    id: r.id,
    phase: r.phase,
    called: r.called,
    speed_ms: r.speed_ms,
    live_cards_count: live,
    player_count: playerCount
  }, { headers: { 'Cache-Control': 'no-store' }});
}

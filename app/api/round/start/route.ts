import { NextResponse } from 'next/server';
import { getRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST() {
  const r = getRound();
  
  // If already live, return current state
  if (r.phase === 'live') {
    return NextResponse.json(
      { id: r.id, phase: 'live', speed_ms: r.speed_ms, called: r.called },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  // Start new round without resetting players and cards
  r.phase = 'live';
  r.called = [];
  // Don't change the round ID to preserve players and cards
  
  return NextResponse.json(
    { id: r.id, phase: 'live', speed_ms: r.speed_ms, called: r.called },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}

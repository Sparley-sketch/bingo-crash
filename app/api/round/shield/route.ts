import { NextResponse } from 'next/server';
import { getRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const { alias, cardId } = await req.json().catch(() => ({}));
  
  if (!alias) return new NextResponse('alias required', { status: 400 });
  if (!cardId) return new NextResponse('cardId required', { status: 400 });

  const r = getRound();
  
  // Find the player
  const player = r.players[alias];
  if (!player) {
    return new NextResponse('Player not found', { status: 404 });
  }

  // Find the card
  const card = player.cards.find(c => c.id === cardId);
  if (!card) {
    return new NextResponse('Card not found', { status: 404 });
  }

  if (card.exploded) {
    return new NextResponse('Card already exploded', { status: 400 });
  }

  if (card.shieldUsed) {
    return new NextResponse('Shield already used', { status: 400 });
  }

  // Purchase shield for the card
  card.wantsShield = true;

  return NextResponse.json({ 
    ok: true, 
    message: 'Shield purchased successfully' 
  }, { headers: { 'Cache-Control': 'no-store' }});
}

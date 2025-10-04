import { NextResponse } from 'next/server';
import { getRound } from '../_lib/roundStore';

export const dynamic = 'force-dynamic';

// 5x3 grid, 15 numbers (1..25) with 3 bombs at random positions.
function makeCard(id: string, name: string) {
  function shuffle(a: number[]) {
    a = a.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  const nums = shuffle(Array.from({ length: 25 }, (_, i) => i + 1)).slice(0, 15);
  const gridNums = [0, 1, 2].map(r => nums.slice(r * 5, r * 5 + 5));
  const bombIdxs = new Set(shuffle(Array.from({ length: 15 }, (_, i) => i)).slice(0, 3));
  const grid = gridNums.map((row, r) =>
    row.map((n, c) => {
      const flat = r * 5 + c;
      return { n, bomb: bombIdxs.has(flat), daubed: false };
    })
  );
  
  return {
    id, name, grid,
    paused: false, exploded: false, daubs: 0,
    wantsShield: false, shieldUsed: false,
    justExploded: false, justSaved: false
  };
}

export async function POST(req: Request) {
  const { alias, cardName } = await req.json().catch(() => ({}));
  
  if (!alias) return new NextResponse('alias required', { status: 400 });
  if (!cardName) return new NextResponse('cardName required', { status: 400 });

  const r = getRound();
  
  // Ensure player exists
  if (!r.players[alias]) {
    r.players[alias] = { alias, cards: [] };
  }

  // Create a new card with proper bingo structure
  const newCard = makeCard(`card_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, cardName);

  // Add card to player
  r.players[alias].cards.push(newCard);

  return NextResponse.json({ 
    ok: true, 
    cardId: newCard.id,
    totalCards: r.players[alias].cards.length 
  }, { headers: { 'Cache-Control': 'no-store' }});
}
// Centralized server-side state & helpers (in-memory).
// Swap this to a DB if needed.

export type Card = { 
  id: string; 
  name: string;
  grid: Array<Array<{n: number, bomb: boolean, daubed: boolean}>>;
  exploded: boolean; 
  paused: boolean; 
  daubs: number;
  wantsShield: boolean;
  shieldUsed: boolean;
  justExploded: boolean;
  justSaved: boolean;
};
export type PlayerState = { alias: string; cards: Card[]; postedOut?: boolean };
export type Phase = 'setup' | 'live' | 'ended';
export type RoundState = {
  id: string;
  phase: Phase;
  called: number[];
  speed_ms: number;
  deckSize: number;
  players: Record<string, PlayerState>;
  winner?: { alias: string; daubs: number };
  ended_at?: number;
};

function generateId(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36);
}

let round: RoundState = {
  id: generateId(),
  phase: 'setup',
  called: [],
  speed_ms: 800,
  deckSize: 25,
  players: {}
};

export function getRound(): RoundState { return round; }
export function resetRound() {
  round = {
    id: generateId(),
    phase: 'setup',
    called: [],
    speed_ms: 800,
    deckSize: 25,
    players: {}
  };
}

export function recomputeLiveCardsCount(r: RoundState = round): number {
  let total = 0;
  for (const p of Object.values(r.players)) {
    total += p.cards.filter(c => !c.exploded && !c.paused).length;
  }
  return total;
}

export function computeWinner(r: RoundState = round): { alias: string; daubs: number } | undefined {
  let bestDaubs = -1;
  let best: { alias: string; daubs: number } | undefined;
  for (const p of Object.values(r.players)) {
    const alive = p.cards.filter(c => !c.exploded);
    const maxDaubs = alive.length ? Math.max(...alive.map(c => c.daubs)) : 0;
    if (maxDaubs > bestDaubs) {
      bestDaubs = maxDaubs;
      best = { alias: p.alias, daubs: maxDaubs };
    }
  }
  return best ?? { alias: '—', daubs: 0 };
}

export function maybeEndRound(r: RoundState = round) {
  if (r.phase !== 'live') return;
  const live = recomputeLiveCardsCount(r);
  const deckExhausted = r.called.length >= r.deckSize;
  if (live === 0 || deckExhausted) {
    r.phase = 'ended';
    r.ended_at = Date.now();
    r.winner = computeWinner(r);
  }
}

// Hook for your engine to apply a call to every player's cards server-side.
// Replace this stub with your real logic.
export function applyCallServerSide(n: number, r: RoundState = round) {
  // In a real bingo game, cards have specific numbers and only get daubs
  // when the called number matches a number on that card.
  for (const p of Object.values(r.players)) {
    for (const c of p.cards) {
      if (!c.exploded && !c.paused) {
        // Check if the called number exists on this card
        let foundNumber = false;
        for (const row of c.grid) {
          for (const cell of row) {
            if (cell.n === n && !cell.daubed) {
              cell.daubed = true;
              c.daubs = (c.daubs ?? 0) + 1;
              foundNumber = true;
              
              // Check if this was a bomb - if so, handle shield protection
              if (cell.bomb) {
                if (c.wantsShield && !c.shieldUsed) {
                  // Shield protects from the first bomb
                  c.shieldUsed = true;
                  c.justSaved = true;
                  // Number is still daubed, but card doesn't explode
                } else {
                  // No shield or shield already used - card explodes
                  c.exploded = true;
                  c.justExploded = true;
                }
              }
              break;
            }
          }
          if (foundNumber) break;
        }
      }
    }
  }
}

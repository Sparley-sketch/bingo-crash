// app/api/round/end/route.ts
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getRound, computeWinner } from '../../_lib/roundStore';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Disable caches for all responses */
function nocache() {
  return {
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Expires: '0',
  };
}

/** Admin (service-role) client: read/write rounds safely */
function admin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!url || !key) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, key, { auth: { persistSession: false } });
}

/** Types you likely have on your "rounds" table (adjust as needed) */
type RoundRow = {
  id: string;
  phase: 'idle' | 'live' | 'ended' | string;
  called?: number[] | null;       // array of called ball numbers
  deck?: number[] | null;         // optional: full deck stored as array
  total_balls?: number | null;    // optional: deck size if not storing the full deck
  winner_alias?: string | null;   // optional: winner display name/alias
  ended_at?: string | null;
};

/** Fetch a round with the fields we need */
async function getRound(supabase: ReturnType<typeof admin>, roundId: string) {
  const { data, error } = await supabase
    .from('rounds')
    .select('id, phase, called, deck, total_balls, winner_alias, ended_at')
    .eq('id', roundId)
    .maybeSingle();
  if (error) throw new Error(`Failed to load round: ${error.message}`);
  if (!data) throw new Error('Round not found');
  return data as RoundRow;
}

/**
 * Count server-side "live cards" for the round.
 * IMPORTANT: Adjust the table/column names in the TODO below to match your schema.
 */
async function countLiveCards(supabase: ReturnType<typeof admin>, roundId: string) {
  // TODO: If your table is named differently (e.g., "tickets", "round_cards"),
  // and your live indicator is different (e.g., status in ('active','live')), update this query.
  const { count, error } = await supabase
    .from('cards')                 // <-- TODO: table name
    .select('id', { count: 'exact', head: true })
    .eq('round_id', roundId)       // <-- TODO: foreign key column
    .eq('is_live', true);          // <-- TODO: live-state column
  if (error) throw new Error(`Failed to count live cards: ${error.message}`);
  return count ?? 0;
}

/** Decide if deck is exhausted based on your available round fields */
function isDeckExhausted(r: RoundRow) {
  const calls = Array.isArray(r.called) ? r.called.length : 0;

  // Prefer explicit total if present
  if (typeof r.total_balls === 'number' && r.total_balls > 0) {
    return calls >= r.total_balls;
  }

  // Otherwise, if entire deck is stored, compare lengths
  if (Array.isArray(r.deck)) {
    return calls >= r.deck.length;
  }

  // Fallback: cannot determine; assume not exhausted
  return false;
}

/** End the round atomically if not already ended */
async function endRoundIfNeeded(
  supabase: ReturnType<typeof admin>,
  roundId: string,
  extra: Partial<RoundRow> = {}
) {
  const patch: any = {
    phase: 'ended',
    ended_at: new Date().toISOString(),
    ...extra,
  };

  const { data, error } = await supabase
    .from('rounds')
    .update(patch)
    .eq('id', roundId)
    .neq('phase', 'ended') // avoid touching already-ended rows
    .select('id, phase, called')
    .maybeSingle();

  if (error) throw new Error(`Failed to end round: ${error.message}`);

  // If data is null, either already ended or row not found under the filter;
  // fetch current for a consistent response.
  if (!data) {
    const { data: current, error: readErr } = await supabase
      .from('rounds')
      .select('id, phase, called')
      .eq('id', roundId)
      .maybeSingle();
    if (readErr) throw new Error(`Failed to read round after end attempt: ${readErr.message}`);
    return current as { id: string; phase: string; called: number[] | null } | null;
  }

  return data as { id: string; phase: string; called: number[] | null } | null;
}

/** Check if there is a winner recorded */
function hasWinner(r: RoundRow) {
  return !!r.winner_alias && String(r.winner_alias).trim().length > 0;
}

export async function POST(req: Request) {
  try {
    const supabase = admin();

    // Accept roundId from either JSON body or query param (?roundId=...)
    let roundId: string | null = null;
    try {
      const url = new URL(req.url);
      roundId = url.searchParams.get('roundId');
    } catch {}
    if (!roundId) {
      try {
        const body = await req.json().catch(() => null);
        roundId = body?.roundId ?? null;
      } catch {}
    }
    if (!roundId) {
      return NextResponse.json({ ok: false, error: 'Missing roundId' }, { status: 400, headers: nocache() });
    }

    // Load round
    const round = await getRound(supabase, roundId);
    const calls = Array.isArray(round.called) ? round.called.length : 0;

    // Authoritative server-side count of "live" cards across ALL players
    const liveCards = await countLiveCards(supabase, roundId);

    // Compute termination signals
    const deckExhausted = isDeckExhausted(round);
    const winnerRecorded = hasWinner(round);

    // The round should END only when NO live cards remain (server-side), OR the deck is exhausted
    const shouldEnd = deckExhausted || liveCards === 0;

    // The "winner popup" should be shown only AFTER the round ended.
    // We return a flag the client can use to sequence the popup strictly after ended.
    let updatedPhase = round.phase;

    if (shouldEnd && round.phase !== 'ended') {
      const updated = await endRoundIfNeeded(supabase, roundId);
      if (updated?.phase) updatedPhase = updated.phase as RoundRow['phase'];
    }

    const ended = updatedPhase === 'ended';

    // Only allow the client to show the winner popup after the round ended.
    const showWinnerPopup = ended && winnerRecorded;

    return NextResponse.json(
      {
        ok: true,
        roundId,
        phase: updatedPhase,
        calls,
        deckExhausted,
        liveCards,
        winnerRecorded,
        showWinnerPopup,
      },
      { status: 200, headers: nocache() }
    );
  } catch (e: any) {
    return NextResponse.json(
      { ok: false, error: e?.message || 'unknown' },
      { status: 500, headers: nocache() }
    );
  }
}
export async function POST() {
  const r = getRound();
  if (r.phase === 'live') {
    r.phase = 'ended';
    r.ended_at = Date.now();
    r.winner = computeWinner(r);
  }
  return NextResponse.json({ ok: true });
}
import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    // Get current round
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (roundError && roundError.code !== 'PGRST116') {
      console.error('Error fetching round:', roundError);
      return NextResponse.json({ error: 'Failed to fetch round' }, { status: 500 });
    }

    if (!round) {
      return NextResponse.json({ error: 'No round found' }, { status: 404 });
    }

    // Stop accepting calls if game is not live
    if (round.phase !== 'live') {
      return NextResponse.json({ error: 'Game not live' }, { status: 409 });
    }

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

    const calledNumbers = round.called || [];
    
    if (!calledNumbers.includes(n)) {
      const newCalledNumbers = [...calledNumbers, n];
      
      // Update the round with the new called number
      const { error: updateError } = await supabaseAdmin
        .from(tableNames.rounds)
        .update({ called: newCalledNumbers })
        .eq('id', round.id);

      if (updateError) {
        console.error('Error updating called numbers:', updateError);
        return NextResponse.json({ error: 'Failed to update called numbers' }, { status: 500 });
      }

      // Apply the call to all cards (this would need to be implemented based on your card logic)
      // For now, we'll just update the called numbers
      console.log(`Called number: ${n}, total called: ${newCalledNumbers.length}`);
    }

    return NextResponse.json({ 
      ok: true, 
      called: (round.called || []).length + 1, 
      number: n 
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in call endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

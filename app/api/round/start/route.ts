import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Get current round
    const { data: currentRound, error: fetchError } = await supabaseAdmin
      .from('rounds')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('Error fetching current round:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current round' }, { status: 500 });
    }

    // If already live, return current state
    if (currentRound && currentRound.phase === 'live') {
      return NextResponse.json(
        { 
          id: currentRound.id, 
          phase: 'live', 
          speed_ms: currentRound.speed_ms, 
          called: currentRound.called || [] 
        },
        { headers: { 'Cache-Control': 'no-store' } }
      );
    }

    // Start new round - update existing round or create new one
    const roundData = {
      phase: 'live',
      called: [],
      speed_ms: 800
    };

    let result;
    if (currentRound) {
      // Update existing round
      const { data, error } = await supabaseAdmin
        .from('rounds')
        .update(roundData)
        .eq('id', currentRound.id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating round:', error);
        return NextResponse.json({ error: 'Failed to update round' }, { status: 500 });
      }
      result = data;
    } else {
      // Create new round
      const { data, error } = await supabaseAdmin
        .from('rounds')
        .insert([roundData])
        .select()
        .single();
      
      if (error) {
        console.error('Error creating round:', error);
        return NextResponse.json({ error: 'Failed to create round' }, { status: 500 });
      }
      result = data;
    }

    return NextResponse.json(
      { 
        id: result.id, 
        phase: 'live', 
        speed_ms: result.speed_ms, 
        called: result.called || [] 
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (error) {
    console.error('Unexpected error in start round:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

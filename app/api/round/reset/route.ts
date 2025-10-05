import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Create a new round with setup phase
    const { data: newRound, error: insertError } = await supabaseAdmin
      .from('rounds')
      .insert([{
        phase: 'setup',
        called: [],
        speed_ms: 800
      }])
      .select()
      .single();

    if (insertError) {
      console.error('Error creating new round:', insertError);
      return NextResponse.json({ error: 'Failed to create new round' }, { status: 500 });
    }

    return NextResponse.json({ 
      ok: true, 
      id: newRound.id, 
      phase: newRound.phase, 
      speed_ms: newRound.speed_ms, 
      called: newRound.called || [] 
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in reset endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

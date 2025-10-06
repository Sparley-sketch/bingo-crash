import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    // Get speed_ms from config
    let speedMs = 800; // default
    try {
      const { data: configData, error: configError } = await supabaseAdmin
        .from('config')
        .select('value')
        .eq('key', 'round.duration_ms')
        .single();
      
      if (!configError && configData?.value) {
        speedMs = parseInt(configData.value) || 800;
      }
    } catch (error) {
      console.log('Could not fetch config, using default speed_ms:', error);
    }

    // Create a new round with setup phase
    const { data: newRound, error: insertError } = await supabaseAdmin
      .from('rounds')
      .insert([{
        phase: 'setup',
        called: [],
        speed_ms: speedMs
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

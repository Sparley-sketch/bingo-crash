import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';
import { getCertifiedRandom } from '@/lib/certifiedRNG';
import { verifyAdminAuth } from '@/lib/adminAuth';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const callStartTime = Date.now();
  const callTimestamp = new Date().toISOString();
  
  try {
    // Verify admin authentication
    const authError = await verifyAdminAuth(req);
    if (authError) {
      return authError;
    }
    // Get current round - optimized query
    const { data: round, error: roundError } = await supabaseAdmin
      .from(tableNames.rounds)
      .select('id, phase, called, speed_ms, prize_pool')
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
      // If no body or invalid JSON, generate a certified random number
      n = getCertifiedRandom(1, 25);
    }

    // If no number provided or invalid, generate a certified random number
    if (typeof n !== 'number' || n < 1 || n > 25) {
      n = getCertifiedRandom(1, 25);
    }

    const calledNumbers = round.called || [];
    
    if (!calledNumbers.includes(n)) {
      const newCalledNumbers = [...calledNumbers, n];
      
            // Update the round with the new called number - optimized update
            const { error: updateError } = await supabaseAdmin
              .from(tableNames.rounds)
              .update({ called: newCalledNumbers, updated_at: new Date().toISOString() })
              .eq('id', round.id)
              .select('id')
              .single();

      if (updateError) {
        console.error('Error updating called numbers:', updateError);
        return NextResponse.json({ error: 'Failed to update called numbers' }, { status: 500 });
      }

      // Apply the call to all cards (this would need to be implemented based on your card logic)
      // For now, we'll just update the called numbers
      
      const callEndTime = Date.now();
      const totalCallTime = callEndTime - callStartTime;
      const currentCallNumber = newCalledNumbers.length;
      
      console.log(`🎯 BALL CALL TIMING DETAILS:`);
      console.log(`  📅 Timestamp: ${callTimestamp}`);
      console.log(`  ⏰ Start Time: ${callStartTime}ms`);
      console.log(`  ⏰ End Time: ${callEndTime}ms`);
      console.log(`  ⏱️  Total Call Time: ${totalCallTime}ms`);
      console.log(`  🔢 Called Number: ${n}`);
      console.log(`  📊 Current Call #: ${currentCallNumber}/25`);
      console.log(`  🎲 All Called Numbers: [${newCalledNumbers.join(', ')}]`);
      
      // Log timing performance
      if (totalCallTime > 100) {
        console.warn(`⚠️  SLOW BALL CALL: ${totalCallTime}ms (number ${n})`);
      } else if (totalCallTime < 50) {
        console.log(`✅ FAST BALL CALL: ${totalCallTime}ms (number ${n})`);
      } else {
        console.log(`⚡ NORMAL BALL CALL: ${totalCallTime}ms (number ${n})`);
      }
    }

    const finalCallTime = Date.now() - callStartTime;
    console.log(`🏁 FINAL API RESPONSE TIME: ${finalCallTime}ms for ball ${n}`);

    return NextResponse.json({ 
      ok: true, 
      called: (round.called || []).length + 1, 
      number: n,
      timing: {
        callStartTime,
        callEndTime: Date.now(),
        totalTime: finalCallTime,
        timestamp: callTimestamp
      }
    }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in call endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

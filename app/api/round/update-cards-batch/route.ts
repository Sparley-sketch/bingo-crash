import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { updates } = await req.json();

    if (!Array.isArray(updates) || updates.length === 0) {
      return NextResponse.json({ error: 'No updates provided' }, { status: 400 });
    }

    // Validate each update
    for (const update of updates) {
      if (!update.cardId || typeof update.cardId !== 'string') {
        return NextResponse.json({ error: 'Invalid cardId in update' }, { status: 400 });
      }
    }

    // Batch update all cards in a single transaction
    const updatePromises = updates.map(update => {
      const updateData: any = {};
      
      if (update.exploded !== undefined) updateData.exploded = update.exploded;
      if (update.paused !== undefined) updateData.paused = update.paused;
      if (update.daubs !== undefined) updateData.daubs = update.daubs;
      if (update.shieldUsed !== undefined) updateData.shield_used = update.shieldUsed;
      
      if (Object.keys(updateData).length === 0) {
        return Promise.resolve(); // No changes to update
      }

      return supabaseAdmin
        .from(tableNames.cards)
        .update(updateData)
        .eq('id', update.cardId);
    });

    // Execute all updates in parallel
    const results = await Promise.allSettled(updatePromises);
    
    // Check for any failures
    const failures = results.filter(result => result.status === 'rejected');
    if (failures.length > 0) {
      console.error('Some card updates failed:', failures);
      return NextResponse.json({ 
        error: `${failures.length} out of ${updates.length} updates failed`,
        success: results.length - failures.length,
        total: updates.length
      }, { status: 207 }); // 207 Multi-Status
    }

    return NextResponse.json({ 
      success: true, 
      updated: updates.length 
    }, { headers: { 'Cache-Control': 'no-store' } });

  } catch (error) {
    console.error('Error in batch card update:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

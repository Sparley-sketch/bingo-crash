import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { cardId, exploded, paused, daubs, shieldUsed } = await req.json().catch(() => ({}));
    
    if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

    // Update the card in the database
    const updateData: any = {};
    if (exploded !== undefined) updateData.exploded = exploded;
    if (paused !== undefined) updateData.paused = paused;
    if (daubs !== undefined) updateData.daubs = daubs;
    if (shieldUsed !== undefined) updateData.shield_used = shieldUsed;

    const { error: updateError } = await supabaseAdmin
      .from(tableNames.cards)
      .update(updateData)
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating card:', updateError);
      return NextResponse.json({ error: 'Failed to update card' }, { status: 500 });
    }

    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in update card endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

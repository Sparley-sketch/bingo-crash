import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    console.log('Update card endpoint called');
    
    const { cardId, exploded, paused, daubs, shieldUsed } = await req.json().catch(() => ({}));
    
    if (!cardId) return NextResponse.json({ error: 'cardId required' }, { status: 400 });

    console.log('Updating card:', { cardId, exploded, paused, daubs, shieldUsed });

    // Update the card in the database
    const updateData: any = {};
    if (exploded !== undefined) updateData.exploded = exploded;
    if (paused !== undefined) updateData.paused = paused;
    if (daubs !== undefined) updateData.daubs = daubs;
    if (shieldUsed !== undefined) updateData.shield_used = shieldUsed;

    // First, check if the card exists
    const { data: existingCard, error: fetchError } = await supabaseAdmin
      .from('cards')
      .select('id, exploded, paused, daubs, shield_used')
      .eq('id', cardId)
      .single();

    if (fetchError) {
      console.error('Error fetching card:', fetchError);
      console.error('Card ID being searched:', cardId);
      return NextResponse.json({ error: `Card not found: ${fetchError.message}` }, { status: 404 });
    }

    console.log('Found card:', existingCard);

    const { error: updateError } = await supabaseAdmin
      .from('cards')
      .update(updateData)
      .eq('id', cardId);

    if (updateError) {
      console.error('Error updating card:', updateError);
      console.error('Update data:', updateData);
      console.error('Card ID:', cardId);
      return NextResponse.json({ error: `Failed to update card: ${updateError.message}` }, { status: 500 });
    }

    console.log('Card updated successfully:', cardId);
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' }});
  } catch (error) {
    console.error('Unexpected error in update card endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

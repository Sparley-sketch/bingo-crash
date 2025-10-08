import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

// GET - Get pricing configuration
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableNames.config)
      .select('key, value')
      .in('key', ['card_price', 'shield_price_percent']);

    if (error) {
      console.error('Error fetching pricing config:', error);
      return NextResponse.json({ error: 'Failed to fetch pricing config' }, { status: 500 });
    }

    const config = {
      cardPrice: 10,
      shieldPricePercent: 50
    };

    data?.forEach(item => {
      if (item.key === 'card_price') {
        config.cardPrice = Number(item.value) || 10;
      } else if (item.key === 'shield_price_percent') {
        config.shieldPricePercent = Number(item.value) || 50;
      }
    });

    return NextResponse.json(config, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in pricing endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Update pricing configuration
export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const { cardPrice, shieldPricePercent } = body;

    if (cardPrice !== undefined) {
      const price = Math.max(1, Math.min(1000, Number(cardPrice) || 10));
      await supabaseAdmin
        .from(tableNames.config)
        .upsert({ 
          key: 'card_price', 
          value: price, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
    }

    if (shieldPricePercent !== undefined) {
      const percent = Math.max(0, Math.min(100, Number(shieldPricePercent) || 50));
      await supabaseAdmin
        .from(tableNames.config)
        .upsert({ 
          key: 'shield_price_percent', 
          value: percent, 
          updated_at: new Date().toISOString() 
        }, { onConflict: 'key' });
    }

    return NextResponse.json({ success: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in pricing update endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

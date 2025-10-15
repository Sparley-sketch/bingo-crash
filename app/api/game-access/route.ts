import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

// GET - Check if game is enabled
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'game_enabled')
      .maybeSingle();

    if (error) {
      console.error('Error fetching game access config:', error);
      return NextResponse.json({ error: 'Failed to fetch game access' }, { status: 500 });
    }

    // Default to enabled if not set
    const isEnabled = data?.value !== false;

    return NextResponse.json({ 
      enabled: isEnabled 
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in game access GET:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Toggle game access
export async function POST(req: Request) {
  try {
    const { enabled } = await req.json();

    if (typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    const { error } = await supabaseAdmin
      .from(tableNames.config)
      .upsert({ 
        key: 'game_enabled', 
        value: enabled,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) {
      console.error('Error updating game access:', error);
      return NextResponse.json({ error: 'Failed to update game access' }, { status: 500 });
    }

    console.log(`Game access ${enabled ? 'ENABLED' : 'DISABLED'}`);

    return NextResponse.json({ 
      success: true, 
      enabled 
    }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in game access POST:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}





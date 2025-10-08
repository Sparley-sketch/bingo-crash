import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { tableNames } from '@/lib/config';

export const dynamic = 'force-dynamic';

// Get scheduler configuration
export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (error) {
      console.error('Error fetching scheduler config:', error);
      return NextResponse.json({ error: 'Failed to fetch scheduler config' }, { status: 500 });
    }

    // Default scheduler configuration
    const defaultConfig = {
      enabled: false,
      preBuyMinutes: 2,
      nextGameStart: null,
      currentPhase: 'setup', // 'setup', 'live', 'ended', 'winner_display'
      winnerDisplaySeconds: 1,
      purchaseBlockSeconds: 5
    };

    const schedulerConfig = data?.value ? { ...defaultConfig, ...data.value } : defaultConfig;

    return NextResponse.json(schedulerConfig, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in scheduler GET endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// Update scheduler configuration
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { enabled, preBuyMinutes, nextGameStart, currentPhase } = body;

    // Validate input
    if (enabled !== undefined && typeof enabled !== 'boolean') {
      return NextResponse.json({ error: 'enabled must be a boolean' }, { status: 400 });
    }

    if (preBuyMinutes !== undefined && (typeof preBuyMinutes !== 'number' || preBuyMinutes < 1 || preBuyMinutes > 60)) {
      return NextResponse.json({ error: 'preBuyMinutes must be between 1 and 60' }, { status: 400 });
    }

    // Get current config
    const { data: currentData, error: fetchError } = await supabaseAdmin
      .from(tableNames.config)
      .select('value')
      .eq('key', 'scheduler')
      .maybeSingle();

    if (fetchError) {
      console.error('Error fetching current scheduler config:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch current config' }, { status: 500 });
    }

    // Merge with existing config
    const currentConfig = currentData?.value || {};
    const updatedConfig = {
      ...currentConfig,
      ...(enabled !== undefined && { enabled }),
      ...(preBuyMinutes !== undefined && { preBuyMinutes }),
      ...(nextGameStart !== undefined && { nextGameStart }),
      ...(currentPhase !== undefined && { currentPhase }),
      updated_at: new Date().toISOString()
    };

    // Save updated config
    const { error: saveError } = await supabaseAdmin
      .from(tableNames.config)
      .upsert({ 
        key: 'scheduler', 
        value: updatedConfig, 
        updated_at: new Date().toISOString() 
      }, { onConflict: 'key' });

    if (saveError) {
      console.error('Error saving scheduler config:', saveError);
      return NextResponse.json({ error: 'Failed to save scheduler config' }, { status: 500 });
    }

    return NextResponse.json(updatedConfig, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    console.error('Unexpected error in scheduler POST endpoint:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

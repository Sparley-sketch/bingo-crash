import { NextResponse } from 'next/server';
import { isDevelopment, tableNames, devSettings } from '@/lib/config';

export const dynamic = 'force-dynamic';

export async function GET() {
  if (!isDevelopment) {
    return NextResponse.json({ error: 'Development endpoint only' }, { status: 403 });
  }

  return NextResponse.json({
    environment: 'development',
    isDevelopment,
    tableNames,
    devSettings,
    timestamp: new Date().toISOString()
  });
}







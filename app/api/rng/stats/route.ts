import { NextResponse } from 'next/server';
import { runStatisticalTestBattery, exportTestDataForCertification } from '@/lib/rngStatisticalTests';
import { getRNGSystemInfo } from '@/lib/rng';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rng/stats
 * Run statistical tests for RNG certification
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'battery';

    switch (action) {
      case 'battery':
        // Run complete statistical test battery
        const testResults = await runStatisticalTestBattery();
        
        return NextResponse.json({
          testResults,
          timestamp: Date.now()
        }, { 
          headers: { 
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          }
        });

      case 'export':
        // Export test data for external analysis
        const sampleSize = parseInt(url.searchParams.get('samples') || '1000000');
        const testData = exportTestDataForCertification(sampleSize);
        
        return NextResponse.json({
          testData: {
            binaryLength: testData.binary.length,
            decimalLength: testData.decimal.length,
            hexLength: testData.hex.length,
            sampleSize
          },
          // Include actual data for small samples (for testing)
          ...(sampleSize <= 1000 ? { data: testData } : {}),
          timestamp: Date.now()
        }, { 
          headers: { 
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          }
        });

      case 'info':
        // Get RNG system information
        const systemInfo = getRNGSystemInfo();
        
        return NextResponse.json({
          systemInfo,
          timestamp: Date.now()
        }, { 
          headers: { 
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          }
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('RNG stats error:', error);
    return NextResponse.json({ 
      error: 'Failed to run statistical tests',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

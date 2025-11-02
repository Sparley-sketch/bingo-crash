import { NextResponse } from 'next/server';
import { getRNGSystemStats, getRoundAuditTrail, verifyRNGRoundIntegrity } from '@/lib/rngDatabase';
import { getRNGSystemInfo, validateRNGIntegrity } from '@/lib/rng';

export const dynamic = 'force-dynamic';

/**
 * GET /api/rng/audit
 * Get RNG system audit information for certification
 */
export async function GET(req: Request) {
  try {
    const url = new URL(req.url);
    const roundId = url.searchParams.get('roundId');
    const action = url.searchParams.get('action') || 'system';

    switch (action) {
      case 'system':
        // Get overall RNG system statistics
        const systemStats = await getRNGSystemStats();
        const systemInfo = getRNGSystemInfo();
        const integrityCheck = validateRNGIntegrity();
        
        return NextResponse.json({
          systemInfo,
          systemStats,
          integrityCheck,
          timestamp: Date.now()
        }, { 
          headers: { 
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          }
        });

      case 'round':
        if (!roundId) {
          return NextResponse.json({ error: 'roundId parameter required' }, { status: 400 });
        }

        // Get audit trail for specific round
        const auditTrail = await getRoundAuditTrail(roundId);
        const roundIntegrity = await verifyRNGRoundIntegrity(roundId);

        return NextResponse.json({
          roundId,
          auditTrail,
          integrity: roundIntegrity,
          timestamp: Date.now()
        }, { 
          headers: { 
            'Cache-Control': 'no-store',
            'Content-Type': 'application/json'
          }
        });

      case 'integrity':
        // Validate overall RNG system integrity
        const integrity = validateRNGIntegrity();
        
        return NextResponse.json({
          integrity,
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
    console.error('RNG audit error:', error);
    return NextResponse.json({ 
      error: 'Failed to retrieve RNG audit data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}







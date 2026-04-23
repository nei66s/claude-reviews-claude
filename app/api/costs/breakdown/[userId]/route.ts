import { NextRequest, NextResponse } from 'next/server';
import { getCostBreakdown } from '@/lib/agent/costTracker';

export const dynamic = 'force-dynamic';

/**
 * Native Cost Breakdown API
 * Replaces the proxy to port 3001 with direct calls to the cost tracker.
 */

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params;

    if (!userId) {
      return NextResponse.json(
        { error: 'userId required' },
        { status: 400 }
      );
    }

    // Call the native cost tracker logic directly
    const breakdown = await getCostBreakdown(userId);

    const response = NextResponse.json({ ok: true, breakdown });
    response.headers.set("Cache-Control", "no-store");
    return response;
    
  } catch (error) {
    console.error('[Costs API Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

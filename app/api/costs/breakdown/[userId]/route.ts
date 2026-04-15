import { NextRequest, NextResponse } from 'next/server'

const breakdownCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds
const FETCH_TIMEOUT = 3000 // 3 second timeout (reduced from 5s)

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  const { userId } = await params

  if (!userId) {
    return NextResponse.json(
      { error: 'userId required' },
      { status: 400 }
    )
  }

  const cached = breakdownCache.get(userId)
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    
    const response = await fetch(
      `http://127.0.0.1:3001/api/costs/breakdown/${userId}`,
      { cache: 'no-store', signal: controller.signal, keepalive: false }
    )

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      breakdownCache.set(userId, { data, timestamp: Date.now() })
      return NextResponse.json(data)
    }
  } catch {
    console.log('Backend slow/unavailable, using fallback')
  }

  // Mock fallback data
  const mockData = {
    ok: true,
    breakdown: {
      userId,
      totalCost: 2.3421,
      byChatId: {
        'chat-1': 0.5205,
        'chat-2': 0.8234,
        'chat-3': 0.9982,
      },
      byModel: {
        'gpt-5': 1.8234,
        'gpt-4': 0.5187,
      },
      thisHour: 0.0045,
      today: 0.0234,
      thisMonth: 0.4521,
    },
  }

  return NextResponse.json(mockData)
}

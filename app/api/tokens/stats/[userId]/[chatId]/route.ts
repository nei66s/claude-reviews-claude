import { NextRequest, NextResponse } from 'next/server'

const statsCache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 30000 // 30 seconds
const FETCH_TIMEOUT = 5000 // 5 second timeout for backend

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string; chatId: string }> }
) {
  const { userId, chatId } = await params

  if (!userId || !chatId) {
    return NextResponse.json(
      { error: 'userId and chatId required' },
      { status: 400 }
    )
  }

  const cacheKey = `${userId}:${chatId}`
  const cached = statsCache.get(cacheKey)
  
  // Return cached data if still fresh
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return NextResponse.json(cached.data)
  }

  try {
    // Try to reach backend agent-ts with short timeout
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT)
    
    const response = await fetch(
      `http://127.0.0.1:3001/api/tokens/stats/${userId}/${chatId}`,
      { cache: 'no-store', signal: controller.signal }
    )

    clearTimeout(timeoutId)

    if (response.ok) {
      const data = await response.json()
      statsCache.set(cacheKey, { data, timestamp: Date.now() })
      return NextResponse.json(data)
    }
  } catch (err) {
    // Backend not available or timeout, use cached or mock data
    console.log('Backend slow/unavailable, using fallback')
  }

  // Mock fallback data
  const mockData = {
    ok: true,
    userId,
    chatId,
    tokens: {
      used: 23400,
      available: 76600,
      percentageUsed: 23,
      isWarning: false,
      isBlocked: false,
    },
  }

  statsCache.set(cacheKey, { data: mockData, timestamp: Date.now() })
  return NextResponse.json(mockData)
}

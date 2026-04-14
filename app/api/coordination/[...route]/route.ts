import { NextRequest, NextResponse } from 'next/server'

/**
 * Coordination API Routes - Proxy to Express Backend
 * Routes all coordination requests to the backend server running on port 3001
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  try {
    const { route } = await params
    const routeParts = route || []
    const pathString = '/' + routeParts.join('/')
    
    // Forward query parameters
    const queryString = request.nextUrl.search
    const backendUrl = `${BACKEND_URL}/api/coordination${pathString}${queryString}`
    
    try {
      const response = await fetch(backendUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      })
      
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    } catch (fetchError) {
      console.error('[Coordination API] Backend connection failed:', fetchError)
      return NextResponse.json(
        { 
          error: 'Backend coordination service unavailable',
          details: 'Make sure the Express server is running on port 3001',
          message: String(fetchError),
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[Coordination API Proxy Error]', error)
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  try {
    const { route } = await params
    const routeParts = route || []
    const pathString = '/' + routeParts.join('/')
    
    let body: Record<string, unknown> = {}
    try {
      body = await request.json()
    } catch (e) {
      // Empty body is OK for some requests
    }
    
    const backendUrl = `${BACKEND_URL}/api/coordination${pathString}`
    
    try {
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
      
      const data = await response.json()
      return NextResponse.json(data, { status: response.status })
    } catch (fetchError) {
      console.error('[Coordination API] Backend connection failed:', fetchError)
      return NextResponse.json(
        { 
          error: 'Backend coordination service unavailable',
          details: 'Make sure the Express server is running on port 3001',
          message: String(fetchError),
        },
        { status: 503 }
      )
    }
  } catch (error) {
    console.error('[Coordination API Proxy Error]', error)
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    )
  }
}




# Coordination API Fix - HTTP 404 Resolution

## Problem
The Coordination Dashboard was showing "Error: HTTP 404" when trying to fetch teams from `/api/coordination/team`.

## Root Cause
The coordination API endpoints were only implemented in the **Express backend** (`agent-ts/src/api/coordinationRoutes.ts`), but the **Next.js frontend** was making requests to `/api/*` paths, which it expected to handle through its own API route handlers. Since no Next.js API routes existed for coordination, it returned 404.

## Solution
Created a **proxy layer** in Next.js API routes that forwards coordination requests to the Express backend.

### Changes Made

#### 1. Backend (agent-ts) - Port Configuration
**File:** `agent-ts/src/server.ts`
- Changed default port from **3000** → **3001**
- Allows Express backend to run on port 3001 while Next.js frontend is on port 3000
- Can be overridden via `PORT` environment variable

```typescript
const port = process.env.PORT || 3001  // Changed from 3000
```

#### 2. Backend (agent-ts) - New Endpoint
**File:** `agent-ts/src/coordination/mailbox.ts`
- Added new function: `getAllTeams()` to fetch all coordination teams
- Returns all teams from the database ordered by creation date

**File:** `agent-ts/src/coordination/index.ts`
- Exported the new `getAllTeams()` function

**File:** `agent-ts/src/api/coordinationRoutes.ts`
- Added route handler: `GET /api/coordination/team`
- Returns list of all teams as `{ teams: [] }`
- Imported and uses the new `getAllTeams()` function

#### 3. Frontend (Next.js) - API Route Proxy
**File:** `app/api/coordination/[...route]/route.ts` (NEW)
- Created catch-all dynamic route for all coordination API requests
- Proxies GET and POST requests to Express backend at `http://localhost:3001`
- Forwards query parameters and request bodies
- Returns 503 (Service Unavailable) with helpful message if backend is down
- Properly handles async `params` in Next.js 16

```typescript
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001'

export async function GET(request: NextRequest, { params }: { params: Promise<{ route: string[] }> }) {
  const { route } = await params  // Await the Promise
  // ... proxy logic
}
```

## Architecture
```
Next.js Frontend (port 3000)
  └─ API Route: /api/coordination/[...route]
      └─ Proxies to ─> Express Backend (port 3001)
                        └─ /api/coordination/*
```

## Running the System

### Start Everything (Recommended)
```bash
# From root directory
npm run dev
# Runs Next.js (3000) + Express backend (3001)
```

### Start Express Backend Only
```bash
# From root directory
cd agent-ts
npm run dev
# Backend runs on port 3001
```

### Start Next.js Frontend Only
```bash
# From root directory
npm run dev:web
# Frontend runs on port 3000
```

### Environment Variables
Set `BACKEND_URL` to override the proxy target:
```bash
BACKEND_URL=http://api.example.com:3001 npm run dev:web
```

## API Endpoints Now Available

From the frontend, these coordination endpoints work:

- `GET /api/coordination/team` - List all teams
- `GET /api/coordination/team/:teamId` - Get specific team
- `POST /api/coordination/team/create` - Create team
- `POST /api/coordination/team/:teamId/register` - Register agent
- Plus all other coordination endpoints...

## Status

✅ **Fixed**  
- Route `/api/coordination/team` now responds with proper error handling
- Returns **503 Service Unavailable** when backend is down (clear error message)
- Returns actual data when backend is running
- Proper async/await handling for Next.js 16 dynamic routes

## Next Steps

1. **Run Express backend** on port 3001 with database connected
2. **Run Next.js frontend** on port 3000
3. Navigate to `http://localhost:3000/coordination`
4. Dashboard should now load coordination data

## Testing

Test the endpoint with curl:
```bash
# Expect 503 if backend not running
curl http://localhost:3000/api/coordination/team

# Response when backend unavailable:
{
  "error": "Backend coordination service unavailable",
  "details": "Make sure the Express server is running on port 3001",
  "message": "..."
}

# Response when backend is running:
{
  "teams": [
    { "id": "team-1", "name": "Default Team", ... }
  ]
}
```

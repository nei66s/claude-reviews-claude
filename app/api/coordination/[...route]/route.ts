import { NextRequest, NextResponse } from 'next/server';
import { 
  ensureFamilyTeamExists, 
  listFamilyMembers 
} from '@/lib/agent/coordination/family-service';
import { 
  getTeamAgents, 
  getAllTeams,
  registerAgent,
  sendMessage
} from '@/lib/agent/coordination/index';
import { triageAgent } from '@/lib/agent/llm';

/**
 * Unified Coordination API
 * Replaces the proxy to port 3001 with direct calls to the agent engine.
 */

export async function GET(
  request: NextRequest, 
  { params }: { params: Promise<{ route: string[] }> }
) {
  try {
    const { route } = await params;
    const path = route.join('/');

    // GET /api/coordination/family/members
    if (path === 'family/members') {
      const members = listFamilyMembers();
      return NextResponse.json({ members, count: members.length });
    }

    // GET /api/coordination/team
    if (path === 'team') {
      const teams = await getAllTeams();
      return NextResponse.json({ teams, count: teams.length });
    }

    // GET /api/coordination/team/:teamId/agents
    const teamAgentsMatch = path.match(/^team\/([^/]+)\/agents$/);
    if (teamAgentsMatch) {
      const teamId = teamAgentsMatch[1];
      const agents = await getTeamAgents(teamId);
      return NextResponse.json({ agents, count: agents.length });
    }

    return NextResponse.json({ error: 'Route not found', path }, { status: 404 });
  } catch (error) {
    console.error('[Coordination API GET Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest, 
  { params }: { params: Promise<{ route: string[] }> }
) {
  try {
    const { route } = await params;
    const path = route.join('/');
    const body = await request.json().catch(() => ({}));

    // POST /api/coordination/family/init
    if (path === 'family/init') {
      const team = await ensureFamilyTeamExists();
      return NextResponse.json({ success: true, team });
    }

    // POST /api/coordination/triage
    if (path === 'triage') {
      const { input, agents, previousAgentId } = body;
      if (!input || !agents || !Array.isArray(agents)) {
        return NextResponse.json({ error: 'Missing input or agents array' }, { status: 400 });
      }
      const result = await triageAgent({ input, agents, previousAgentId });
      return NextResponse.json(result);
    }

    // POST /api/coordination/team/:teamId/spawn
    const spawnMatch = path.match(/^team\/([^/]+)\/spawn$/);
    if (spawnMatch) {
      const teamId = spawnMatch[1];
      const { role, agentId } = body;
      if (!role) return NextResponse.json({ error: 'Role required' }, { status: 400 });
      const id = await registerAgent(teamId, agentId || `agent-${Date.now()}`, role);
      return NextResponse.json({ success: true, id });
    }

    // POST /api/coordination/team/:teamId/send
    const sendMatch = path.match(/^team\/([^/]+)\/send$/);
    if (sendMatch) {
      const teamId = sendMatch[1];
      const { from, to, type, content, metadata } = body;
      if (!from || !content) return NextResponse.json({ error: 'From and content required' }, { status: 400 });
      const messageId = await sendMessage(teamId, from, to || null, type || 'direct_message', content, metadata);
      return NextResponse.json({ success: true, messageId });
    }

    return NextResponse.json({ error: 'Route not found', path }, { status: 404 });
  } catch (error) {
    console.error('[Coordination API POST Error]', error);
    return NextResponse.json(
      { error: 'Internal server error', message: String(error) },
      { status: 500 }
    );
  }
}

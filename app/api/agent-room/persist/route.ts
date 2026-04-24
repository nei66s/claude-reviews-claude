
import { NextRequest } from "next/server";
import { requireUserAgentRoom } from "@/lib/server/request";
import { persistRoomMessage } from "@/lib/server/agent-room/repository";
import { AGENT_ROOM_SESSION_ID } from "@/lib/server/agent-room/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = requireUserAgentRoom(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const { role, agentId, content } = body || {};

  if (!role || !content) {
    return new Response("Missing role or content", { status: 400 });
  }

  await persistRoomMessage(AGENT_ROOM_SESSION_ID, {
    role,
    agentId,
    content
  });

  return Response.json({ ok: true });
}

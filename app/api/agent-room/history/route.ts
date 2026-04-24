
import { NextRequest } from "next/server";
import { requireUserAgentRoom } from "@/lib/server/request";
import { getRoomHistory } from "@/lib/server/agent-room/repository";
import { AGENT_ROOM_SESSION_ID } from "@/lib/server/agent-room/constants";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = requireUserAgentRoom(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const history = await getRoomHistory(AGENT_ROOM_SESSION_ID, 30);
  
  return Response.json({
    messages: history
  });
}

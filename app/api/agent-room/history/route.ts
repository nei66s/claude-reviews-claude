
import { NextRequest } from "next/server";
import { requireUserAgentRoom } from "@/lib/server/request";
import { getRoomHistory } from "@/lib/server/agent-room/repository";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = requireUserAgentRoom(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const history = await getRoomHistory("pimpotasma-global-room", 30);
  
  return Response.json({
    messages: history
  });
}

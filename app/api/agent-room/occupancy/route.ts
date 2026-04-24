
import { NextRequest } from "next/server";
import { persistRoomMessage, getRoomHistory } from "@/lib/server/agent-room/repository";
import { AGENT_PROFILES, AGENT_SEQUENCE } from "@/lib/familyRouting";
import { AGENT_ROOM_SESSION_ID } from "@/lib/server/agent-room/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const workerKey = request.headers.get("x-worker-key");
  if (workerKey !== "pimpotasma-secret-worker-key") {
    return new Response("Unauthorized", { status: 401 });
  }

  // Descobre quem está ativo lendo o histórico recente
  const history = await getRoomHistory(AGENT_ROOM_SESSION_ID, 50);
  const systemMessages = history.filter(m => m.role === "system");
  const activeSet = new Set(AGENT_SEQUENCE.slice(0, 5)); // Base

  systemMessages.forEach(m => {
    const joinedMatch = m.content.match(/(\w+) chegou na sala/);
    const leftMatch = m.content.match(/(\w+) saiu para resolver outros problemas/);
    if (joinedMatch) {
      const id = joinedMatch[1].toLowerCase();
      activeSet.add(id);
    }
    if (leftMatch) {
      const id = leftMatch[1].toLowerCase();
      activeSet.delete(id);
    }
  });

  const currentlyActive = Array.from(activeSet);
  const currentlyInactive = AGENT_SEQUENCE.filter(id => !activeSet.has(id));

  let msg = "";
  let type = "";

  // 80% chance de rotação (mais agressivo para garantir que todos apareçam)
  if (currentlyActive.length > 2 && (Math.random() > 0.3 || currentlyInactive.length === 0)) {
    // Alguém sai (exceto Chocks e Urubu que tem regras próprias)
    const candidates = currentlyActive.filter(id => id !== "chocks" && id !== "urubudopix");
    if (candidates.length > 0) {
      const toLeave = candidates[Math.floor(Math.random() * candidates.length)];
      const name = AGENT_PROFILES[toLeave as keyof typeof AGENT_PROFILES].name;
      msg = `${name} saiu para resolver outros problemas.`;
      type = "leave";
    }
  } 
  
  if (!msg && currentlyInactive.length > 0) {
    // Alguém entra
    const toJoin = currentlyInactive[Math.floor(Math.random() * currentlyInactive.length)];
    const name = AGENT_PROFILES[toJoin as keyof typeof AGENT_PROFILES].name;
    msg = `${name} chegou na sala.`;
    type = "join";
  }

  if (msg) {
    await persistRoomMessage(AGENT_ROOM_SESSION_ID, {
      role: "system",
      agentId: "system",
      content: msg
    });
  }

  return Response.json({ ok: true, message: msg, type });
}

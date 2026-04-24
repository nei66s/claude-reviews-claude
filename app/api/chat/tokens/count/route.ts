import { NextRequest } from "next/server";
import { requireUser } from "@/lib/server/request";
import { countInputTokens } from "@/lib/agent/llm";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { getPsychologicalProfile } from "@/lib/server/psychological-profile";
import { buildContextPack } from "@/lib/server/memory/context-builder";
import { readAppSettings } from "@/lib/server/store";
import { isMemoryOrchestratorEnabled } from "@/lib/server/memory/flags";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    const body = await request.json();
    const messages = Array.isArray(body?.messages) ? body.messages : [];
    const selectedAgentId = typeof body?.selectedAgentId === "string" ? body.selectedAgentId : "chocks";
    const chatId = typeof body?.chatId === "string" ? body.chatId : "";

    const settings = await readAppSettings();
    
    // Build context as close as possible to the real execution
    const [psychProfile, memoryContext] = await Promise.all([
      getPsychologicalProfile(user.id).catch(() => null),
      isMemoryOrchestratorEnabled() && settings.memoryMode !== "off"
        ? buildContextPack({
            userId: user.id,
            agentType: selectedAgentId,
            taskType: "chat",
            limitItems: 12,
            query: messages[messages.length - 1]?.content || "",
          }).catch(() => null)
        : Promise.resolve(null),
    ]);

    const agentMessages = messages.map((m: any) => ({
      role: m.role === "agent" ? "assistant" : m.role,
      content: m.content,
    }));

    const inputTokens = await countInputTokens(agentMessages, {
      chatId,
      userId: user.id,
      displayName: user.displayName,
      fullAccess: settings.fullAccess,
      permissionMode: settings.permissionMode,
      selectedAgentId,
      memoryContext,
      psychProfile
    });

    return Response.json({ inputTokens, object: "response.input_tokens" });
  } catch (error) {
    console.error("Token count API error:", error);
    return new Response(JSON.stringify({ error: String(error) }), { 
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}

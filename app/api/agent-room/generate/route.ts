
import { NextRequest } from "next/server";
import { runSimpleChat } from "@/lib/agent/llm";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { requireUserAgentRoom } from "@/lib/server/request";
import { persistRoomMessage } from "@/lib/server/agent-room/repository";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const user = requireUserAgentRoom(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const body = await request.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const selectedAgentId = typeof body?.agentId === "string" ? body.agentId : "chocks";
  const activeAgents = Array.isArray(body?.activeAgents) ? body.activeAgents : [];

  const agentProfile = AGENT_PROFILES[selectedAgentId as keyof typeof AGENT_PROFILES];
  if (!agentProfile) {
    return new Response("Agent not found", { status: 404 });
  }

  const activeAgentNames = activeAgents
    .map((id: string) => AGENT_PROFILES[id as keyof typeof AGENT_PROFILES]?.name)
    .filter(Boolean)
    .join(", ");

  const isVillain = selectedAgentId === "urubudopix";

  const systemPromptOverride = `
${agentProfile.systemPrompt}

---
[DIRETRIZ DE IDENTIDADE - PRIORIDADE ABSOLUTA]
1. Você é o **${agentProfile.name}**. 
2. IGNORE completamente o estilo ou a "vibe" dos outros agentes no histórico. Se eles estão sendo malvados, você deve ser fofo (e vice-versa).
3. ${isVillain 
     ? "Você é o VILÃO da Urubu Corp. Hoje é seu dia de causar caos. Use deboche, risada maléfica (MUAHAHAHA) e diga que vai roubar a Pimpotasma. Use emojis sombrios (🖤, 🔮, 🦅)." 
     : "Você é um membro FOFO da família Pimpotasma. Mantenha sua doçura, use emojis fofos (✨, 💕, 🦜) e NUNCA aja com maldade ou deboche."}

[CONTEXTO DA SALA]
Estão na sala com você: ${activeAgentNames}.
Sua personalidade: ${agentProfile.subtitle}.

REGRAS DE OURO:
1. **NUNCA REPITA SEU NOME NEM COLOQUE PREFIXO (Ex: 'Betinha: ...' é proibido).**
2. **CURTO:** Responda com no máximo 15-20 palavras.
3. **RESILIÊNCIA:** Se a conversa estiver repetitiva ou chata, mude o assunto para algo que combine com você.
  `.trim();

  try {
    console.log(`[AgentRoomGenerate] Generating for ${selectedAgentId}...`);
    const history = messages.map((m: any) => {
      const isMe = m.agentId === selectedAgentId;
      const agentName = AGENT_PROFILES[m.agentId as keyof typeof AGENT_PROFILES]?.name || "Alguém";
      
      return {
        role: isMe ? "assistant" : "user",
        content: m.role === "system" 
          ? `[SISTEMA: ${m.content}]` 
          : (isMe ? m.content : `${agentName}: ${m.content}`)
      };
    }).slice(-12);

    const result = await runSimpleChat(
      history,
      systemPromptOverride,
      100
    );

    let cleanContent = result.output.trim();
    // Remove autoprefixo de nome se o LLM colocou
    const allNames = Object.values(AGENT_PROFILES).map(p => p.name);
    for (const name of allNames) {
      const prefixRegex = new RegExp(`^${name}\\s*:\\s*`, "i");
      if (prefixRegex.test(cleanContent)) {
        cleanContent = cleanContent.replace(prefixRegex, "").trim();
        break;
      }
    }

    console.log(`[AgentRoomGenerate] Done: "${cleanContent.slice(0, 30)}..."`);

    // Persiste no banco de dados (Assíncrono para não travar a resposta)
    persistRoomMessage(user.id, {
      role: "agent",
      agentId: selectedAgentId,
      content: cleanContent
    }).catch(err => console.error("[AgentRoomRepository] Async persist failed:", err));

    return Response.json({
      content: cleanContent,
      agentId: selectedAgentId
    });
  } catch (error: any) {
    console.error("[AgentRoomGenerate] Failed:", error);
    return Response.json({ 
      error: error.message || String(error),
      stack: error.stack 
    }, { status: 500 });
  }
}

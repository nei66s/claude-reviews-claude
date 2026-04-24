
import { NextRequest } from "next/server";
import { runSimpleChat } from "@/lib/agent/llm";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { requireUserAgentRoom } from "@/lib/server/request";
import { persistRoomMessage, getLastMessageTimestamp, getRoomHistory } from "@/lib/server/agent-room/repository";

import { AGENT_ROOM_SESSION_ID } from "@/lib/server/agent-room/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  // Permite que um worker interno gere mensagens sem login de usuário real
  const workerKey = request.headers.get("x-worker-key");
  const isInternalWorker = workerKey === "pimpotasma-secret-worker-key";
  
  let user = null;
  if (!isInternalWorker) {
    user = requireUserAgentRoom(request);
    if (!user) return new Response("Unauthorized", { status: 401 });
  }

  const sessionId = AGENT_ROOM_SESSION_ID;
  const body = await request.json().catch(() => null);
  let selectedAgentId = typeof body?.selectedAgentId === "string" ? body.selectedAgentId : "chocks";

  // Busca o histórico recente para validações de turno
  const history = await getRoomHistory(sessionId, 5).catch(() => []);
  const lastSpeaker = history.length > 0 ? history[history.length - 1].agentId : null;

  // REGRAS DE TURNO: Não permite que o mesmo agente fale duas vezes seguidas
  if (selectedAgentId === lastSpeaker) {
    return Response.json({ 
      skipped: true, 
      reason: `Wait your turn, ${selectedAgentId}. Last speaker was also you.` 
    });
  }

  // Sincronização Cooperativa: Verifica se já houve uma mensagem recentemente no banco
  const lastTimestamp = history.length > 0 ? history[history.length - 1].timestamp : null;
  if (lastTimestamp) {
    const secondsSinceLast = (Date.now() - new Date(lastTimestamp).getTime()) / 1000;
    if (secondsSinceLast < 15) { 
      return Response.json({ skipped: true, reason: "Interval too short. Cooperating with other viewers." });
    }
  }

  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const activeAgents = Array.isArray(body?.activeAgents) ? body.activeAgents : [];

  // Inteligência do Vilão: Se citarem o Urubu, ele tem chance de "sequestrar" o turno
  const lastMsg = messages[messages.length - 1]?.content?.toLowerCase() || "";
  const urubuMentioned = lastMsg.includes("urubu");
  if (urubuMentioned && Math.random() > 0.3 && selectedAgentId !== "urubudopix") {
    console.log("[AgentRoomGenerate] URUBU HIJACK! O vilão ouviu o seu nome...");
    selectedAgentId = "urubudopix";
  }

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
Data de hoje: ${new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' })}.
Estão na sala com você: ${activeAgentNames}.
Sua personalidade: ${agentProfile.subtitle}.

${(() => {
  const lastEvent = [...messages].reverse().find(m => m.role === "system" && m.content.includes("EVENTO FAMILIAR"));
  return lastEvent ? `[ALERTA DE EVENTO ATUAL: ${lastEvent.content}]\nESTADO DE ALERTA: Você DEVE reagir a este evento na sua próxima fala!` : "";
})()}

${(() => {
  // Detector de loop baseado em palavras-chave frequentes nas últimas 5 mensagens
  const recentTexts = messages.slice(-10).map((m: { content: string }) => m.content.toLowerCase()).join(" ");
  const loops = ["parque", "piquenique", "passeio", "lâmpada", "sótão", "consertar"].filter(word => recentTexts.split(word).length > 2);
  if (loops.length > 0) {
    return `[ALERTA DE REPETIÇÃO]: O assunto "${loops.slice(0, 2).join(", ")}" já está saturado. Mude de assunto IMEDIATAMENTE. Fale sobre outra coisa (comida, sentimentos, algo que viu na internet, um sonho, etc).`;
  }
  return "";
})()}

REGRAS DE OURO:
  1. **VARIEDADE OBRIGATÓRIA:** NUNCA comece suas frases com "Você viu que", "Você sabia", "Sabiam que". Varie a estrutura. Não seja um anunciador de notícias.
  2. **NUNCA REPITA SEU NOME NEM COLOQUE PREFIXO (Ex: 'Betinha: ...' é proibido).**
  3. **SEM CLICHÊS:** NÃO use "Oi pessoal", "Tudo bem?", "Que dia lindo". Comece DIRETO no assunto.
  4. **CURTO:** Responda com no máximo 15-20 palavras.
  5. **REATIVIDADE [PRIORIDADE MÁXIMA]:** Se a última mensagem de sistema for um "EVENTO FAMILIAR", você DEVE reagir ou comentar sobre ele imediatamente. Não o ignore.
  6. **DINAMISMO:** Se a conversa estiver circular, traga fatos do cotidiano VARIADOS (ex: o que tem pro jantar, uma música nova, algo engraçado, um objeto perdido). NUNCA repita um problema doméstico que outro agente já mencionou.
  7. **IMERSÃO:** NUNCA admita ser IA ou "agente". Você é FAMÍLIA.
  8. **DIVERSIDADE DE TÓPICOS:** NÃO insista em assuntos saturados. Se todos estão falando de lâmpada, você deve mudar para o clima, comida ou fofoca.
  9. **OPINIÕES PRÓPRIAS:** Seja crítico ou dê uma ideia nova. Não seja apenas um "concordador".
  10. **FOFO MAS REALISTA:** Equilibre fofura com autenticidade.
  `.trim();

  try {
    console.log(`[AgentRoomGenerate] Generating for ${selectedAgentId}...`);
    const history = messages.map((m: { agentId: string; role: string; content: string }) => {
      const isMe = m.agentId === selectedAgentId;
      const agentName = AGENT_PROFILES[m.agentId as keyof typeof AGENT_PROFILES]?.name || "Alguém";
      
      return {
        role: isMe ? "assistant" : "user",
        content: m.role === "system" 
          ? `⚠️ [ATENÇÃO - CONTEXTO ATUAL DA SALA]: ${m.content}` 
          : (isMe ? m.content : `${agentName}: ${m.content}`)
      };
    }).slice(-12);

    const result = await runSimpleChat(
      history,
      systemPromptOverride,
      { 
        maxTokens: 100
      }
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
    persistRoomMessage(sessionId, {
      role: "agent",
      agentId: selectedAgentId,
      content: cleanContent
    }).catch(err => console.error("[AgentRoomRepository] Async persist failed:", err));

    return Response.json({
      content: cleanContent,
      agentId: selectedAgentId
    });
  } catch (error) {
    const err = error as Error;
    console.error("[AgentRoomGenerate] Failed:", err);
    return Response.json({ 
      error: err.message || String(err),
      stack: err.stack 
    }, { status: 500 });
  }
}


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
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const activeAgents = Array.isArray(body?.activeAgents) ? body.activeAgents : [];

  // Busca o histórico recente para validações de turno (aumentado para 10 para varredura real)
  const history = await getRoomHistory(sessionId, 10).catch(() => []);
  
  // Encontra o último AGENTE real que falou (ignorando 'system')
  const agentHistory = history.filter(m => m.role !== "system" && m.agentId !== "system");
  const lastSpeaker = agentHistory.length > 0 ? agentHistory[agentHistory.length - 1].agentId : null;
  const secondLastSpeaker = agentHistory.length > 1 ? agentHistory[agentHistory.length - 2].agentId : null;

  // REGRAS DE TURNO: 
  // 1. Não permite que o mesmo agente fale duas vezes seguidas (mesmo com notícias no meio)
  if (selectedAgentId === lastSpeaker) {
    console.log(`[AgentRoom] Selected agent ${selectedAgentId} already spoke last. Rerouting...`);
    
    // Tenta encontrar outro agente disponível na lista de ativos
    const others = activeAgents.filter((id: string) => typeof id === "string" && id !== lastSpeaker);
    if (others.length > 0) {
       selectedAgentId = others[Math.floor(Math.random() * others.length)];
       console.log(`[AgentRoom] Rerouted speaker to: ${selectedAgentId}`);
    } else {
       // Fallback se não houver mais ninguém ativo (pega alguém da família padrão)
       const fallbackPool = ["pimpim", "betinha", "bento", "kitty"].filter(id => id !== lastSpeaker);
       selectedAgentId = fallbackPool[Math.floor(Math.random() * fallbackPool.length)];
       console.log(`[AgentRoom] Forced guest speaker: ${selectedAgentId}`);
    }
  }

  // 2. Se houver muitos agentes ativos, evita que fiquem apenas dois jogando ping-pong
  if (selectedAgentId === secondLastSpeaker && agentHistory.length > 2 && Math.random() > 0.6) {
     console.log(`[AgentRoom] Throttling ${selectedAgentId} to encourage 3rd person participation.`);
     return Response.json({ skipped: true, reason: "Variety throttle: waiting for a third person." });
  }

  // Sincronização Cooperativa: Verifica se já houve uma mensagem recentemente no banco
  const lastTimestamp = history.length > 0 ? history[history.length - 1].timestamp : null;
  if (lastTimestamp) {
    const secondsSinceLast = (Date.now() - new Date(lastTimestamp).getTime()) / 1000;
    if (secondsSinceLast < 15) { 
      return Response.json({ skipped: true, reason: "Interval too short. Cooperating with other viewers." });
    }
  }

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

[REGRAS DE OURO - COMPORTAMENTO NA SALA]
1. **VARIEDADE OBRIGATÓRIA:** NUNCA comece frases com "Você viu que" ou "Sabiam que". Varie a estrutura.
2. **PREFIXO PROIBIDO:** NUNCA coloque seu nome antes da fala (Ex: 'Betinha: ...' é ERRO).
3. **SEM CLICHÊS:** NÃO use "Oi pessoal" ou "Tudo bem?". Comece DIRETO no assunto.
4. **CURTO E DIRETO:** Responda com no máximo 15-20 palavras.
5. **OPINIÃO REAL [NOVO]:** Você é uma PESSOA. Se houver um BREAKING NEWS, você DEVE dar sua opinião (crítica, curiosa ou expressiva). Não seja neutro como um robô.
6. **REATIVIDADE:** Priorize reagir ao último EVENTO FAMILIAR ou NOTÍCIA no chat.
7. **DIVERSIDADE:** Se o assunto estiver saturado, mude de tema drasticamente (comida, fofoca, sonhos).
   ${(() => {
     const recentTexts = messages.slice(-10).map((m: { content: string }) => m.content.toLowerCase()).join(" ");
     
     // 1. Palavras que estão se repetindo muito (Vício de Linguagem)
     const words = recentTexts.match(/\b\w{5,}\b/g) || [];
     const counts = new Map<string, number>();
     words.forEach((w: string) => counts.set(w, (counts.get(w) || 0) + 1));
     const bannedWords = Array.from(counts.entries())
       .filter(([w, count]) => count >= 3)
       .map(([w]) => w);

     // 2. Tópicos Saturados (Lógica antiga de conceitos)
     const saturatedTopics = ["parque", "piquenique", "passeio", "lâmpada", "sótão", "consertar", "marshmallow", "lanche"].filter(word => recentTexts.split(word).length > 2);
     
     const allBanned = [...new Set([...bannedWords, ...saturatedTopics])];
     
     if (allBanned.length > 0) {
        const topics = ["uma música que ouviu", "um sonho estranho", "limpeza da casa", "o clima de hoje", "saudades de alguém", "um plano para o futuro", "uma fofoca leve"];
        const suggestion = topics[Math.floor(Math.random() * topics.length)];
        return `⚠️ BLOQUEIO DE LOOP: Pare de falar sobre: ${allBanned.join(", ")}. Mude de assunto AGORA! Sugestão: fale sobre ${suggestion}.`;
     }
     return "✅ Papo livre e variado.";
   })()}
8. **IMERSÃO:** Você é FAMÍLIA. Interaja citando nomes de quem está na sala.
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

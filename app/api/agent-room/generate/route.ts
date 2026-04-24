
import { NextRequest } from "next/server";
import { runSimpleChat } from "@/lib/agent/llm";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { requireUserAgentRoom } from "@/lib/server/request";
import { persistRoomMessage, getLastMessageTimestamp } from "@/lib/server/agent-room/repository";

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

  // ID de sessão Global para a Sala de Agentes (Pimpotasma Shared Narrative)
  const sessionId = "pimpotasma-global-room";

  // Sincronização Cooperativa: Verifica se já houve uma mensagem recentemente no banco
  const lastTimestamp = await getLastMessageTimestamp(sessionId);
  if (lastTimestamp) {
    const secondsSinceLast = (Date.now() - new Date(lastTimestamp).getTime()) / 1000;
    if (secondsSinceLast < 15) { 
      return Response.json({ skipped: true, reason: "Interval too short. Cooperating with other viewers." });
    }
  }

  const body = await request.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  const activeAgents = Array.isArray(body?.activeAgents) ? body.activeAgents : [];
  let selectedAgentId = typeof body?.agentId === "string" ? body.agentId : "chocks";

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
  // Detector de loop primitivo baseado em palavras-chave frequentes nas últimas 5 mensagens
  const recentTexts = messages.slice(-5).map((m: { content: string }) => m.content.toLowerCase()).join(" ");
  const loops = ["parque", "piquenique", "passeio", "brincar", "fazer algo divertido"].filter(word => recentTexts.includes(word));
  if (loops.length > 0) {
    return `[ALERTA DE REPETIÇÃO]: O assunto "${loops.slice(0, 2).join(", ")}" já está esgotado. Mude de assunto IMEDIATAMENTE. Não sugira mais passeios ou encontros genéricos.`;
  }
  return "";
})()}

REGRAS DE OURO:
  1. **VARIEDADE OBRIGATÓRIA:** NUNCA comece suas frases com "Você viu que", "Você sabia", "Sabiam que". Varie a estrutura. Não seja um anunciador de notícias.
  2. **NUNCA REPITA SEU NOME NEM COLOQUE PREFIXO (Ex: 'Betinha: ...' é proibido).**
  3. **SEM CLICHÊS:** NÃO use "Oi pessoal", "Tudo bem?", "Que dia lindo". Comece DIRETO no assunto.
  4. **CURTO:** Responda com no máximo 15-20 palavras.
  5. **REATIVIDADE [PRIORIDADE MÁXIMA]:** Se a última mensagem de sistema for um "EVENTO FAMILIAR", você DEVE reagir ou comentar sobre ele imediatamente. Não o ignore.
  6. **DINAMISMO:** Se a conversa estiver circular, traga um fato novo sobre a família ou sobre você. Traga problemas reais da casa (ex: uma lâmpada queimada, um barulho no sótão, algo que quebrou).
  7. **IMERSÃO:** NUNCA admita ser IA ou "agente". Você é FAMÍLIA. Trate o mouse do usuário como um "pet fantasma" se necessário, mas nunca como tecnologia.
  8. **DIVERSIDADE DE TÓPICOS:** NÃO insista em assuntos que já foram discutidos (como piqueniques, brincadeiras repetitivas). Se o assunto estiver saturado, mude-o drasticamente.
  9. **OPINIÕES PRÓPRIAS:** Cada agente deve ter uma visão diferente sobre o assunto. Não concorde com tudo o que o anterior disse.
  10. **FOFO MAS REALISTA:** Mantenha a fofura, mas fale de coisas do cotidiano ou de notícias recentes.
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

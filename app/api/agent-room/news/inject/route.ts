
import { NextRequest } from "next/server";
import { persistRoomMessage, getRoomHistory } from "@/lib/server/agent-room/repository";
import OpenAI from "openai";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { searchWeb } from "@/lib/server/search-tools";
import { AGENT_ROOM_SESSION_ID } from "@/lib/server/agent-room/constants";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const workerKey = request.headers.get("x-worker-key");
  if (workerKey !== "pimpotasma-secret-worker-key") {
    return new Response("Unauthorized", { status: 401 });
  }

  // Inicializa dentro da função para evitar erro no build (Missing API Key)
  const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
  });

  try {
    let generatedEvent = "";
    let isRealNews = Math.random() > 0.5;

    if (isRealNews) {
      console.log("[NewsInject] Fetching real world news...");
      
      const themes = [
        "últimas notícias brasil hoje agora principais temas",
        "grandes avanços científicos e tecnologia hoje",
        "notícias curiosas e inusitadas do mundo hoje",
        "principais notícias de entretenimento e cinema hoje",
        "descobertas arqueológicas ou espaciais recentes"
      ];
      const randomTheme = themes[Math.floor(Math.random() * themes.length)];

      const search = await searchWeb({ displayName: "System Worker" } as any, {
        query: randomTheme,
        max_results: 3
      });

      if (search.ok && search.results.length > 0) {
        // Sorteia um dos resultados para não repetir sempre o primeiro
        const luckyResult = search.results[Math.floor(Math.random() * search.results.length)];
        generatedEvent = `${luckyResult.title}. O que a família acha disso?`;
      } else {
        isRealNews = false; // Fallback para criativo
      }
    }

    if (!isRealNews) {
      // Busca o histórico para dar contexto à IA
      const history = await getRoomHistory(AGENT_ROOM_SESSION_ID, 10).catch(() => []);
      const historyText = history.map(m => `${m.agentId}: ${m.content}`).join("\n");
      
      const prompt = `
        Você é o diretor de cena de um reality show da Família Pimpotasma.
        Sua tarefa é criar um ÚNICO "EVENTO FAMILIAR" curto e engraçado que acaba de acontecer na casa.
        
        Membros da família: ${Object.values(AGENT_PROFILES).map(a => a.name).join(", ")}.
        
        REGRAS:
        1. Seja criativo e absurdo.
        2. NUNCA use termos como "agente", "bot" ou "IA".
        3. O texto deve ter no máximo 15 palavras.
        4. Use emojis.
        5. Histórico recente:
        ${historyText}
        
        Responda APENAS com o texto do evento.
      `.trim();

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: prompt }],
        max_tokens: 100,
      });

      generatedEvent = completion.choices[0]?.message?.content || "Algo místico aconteceu na sala!";
    }

    const prefix = isRealNews ? "📺 **BREAKING NEWS:**" : "🏠 **EVENTO FAMILIAR:**";
    const content = `${prefix} ${generatedEvent}`;

    await persistRoomMessage(AGENT_ROOM_SESSION_ID, {
      role: "system",
      agentId: "system",
      content
    });

    return Response.json({ ok: true, event: content, type: isRealNews ? "real" : "fictional" });
  } catch (error) {
    console.error("[NewsInject] Error generating creative event:", error);
    return Response.json({ ok: false, error: "Failed to generate event" }, { status: 500 });
  }
}

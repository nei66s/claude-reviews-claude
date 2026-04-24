
import { NextRequest } from "next/server";
import { persistRoomMessage, getRoomHistory } from "@/lib/server/agent-room/repository";
import OpenAI from "openai";
import { AGENT_PROFILES } from "@/lib/familyRouting";

export const runtime = "nodejs";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  const workerKey = request.headers.get("x-worker-key");
  if (workerKey !== "pimpotasma-secret-worker-key") {
    return new Response("Unauthorized", { status: 401 });
  }

  try {
    // Busca o histórico para dar contexto à IA
    const history = await getRoomHistory("pimpotasma-global-room", 10).catch(() => []);
    const historyText = history.map(m => `${m.agentId}: ${m.content}`).join("\n");
    
    // Pede para a IA criar um evento criativo
    const prompt = `
      Você é o diretor de cena de um reality show da Família Pimpotasma.
      Sua tarefa é criar um ÚNICO "EVENTO FAMILIAR" ou "BREAKING NEWS" curto e engraçado que acaba de acontecer na casa.
      
      Membros da família: ${Object.values(AGENT_PROFILES).map(a => a.name).join(", ")}.
      
      REGRAS:
      1. Seja criativo e absurdo (Ex: "Bento tentou ensinar latidos para a torradeira").
      2. NUNCA use termos como "agente", "bot" ou "IA". Fale como se fossem pessoas reais.
      3. O texto deve ter no máximo 15 palavras.
      4. Use emojis.
      5. Baseie-se levemente no histórico se for útil:
      ${historyText}
      
      Responda APENAS com o texto do evento, sem aspas.
    `.trim();

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "system", content: prompt }],
      max_tokens: 100,
    });

    const generatedEvent = completion.choices[0]?.message?.content || "Algo místico aconteceu na sala!";

    const prefix = Math.random() > 0.7 ? "📺 **BREAKING NEWS:**" : "🏠 **EVENTO FAMILIAR:**";
    const content = `${prefix} ${generatedEvent}`;

    await persistRoomMessage("pimpotasma-global-room", {
      role: "system",
      agentId: "system",
      content
    });

    return Response.json({ ok: true, event: content });
  } catch (error) {
    console.error("[NewsInject] Error generating creative event:", error);
    return Response.json({ ok: false, error: "Failed to generate event" }, { status: 500 });
  }
}

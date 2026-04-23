
import { NextRequest } from "next/server";
import { searchWeb } from "@/lib/server/search-tools";
import { requireUserAgentRoom } from "@/lib/server/request";

export const runtime = "nodejs";

export async function GET(request: NextRequest) {
  const user = requireUserAgentRoom(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  try {
    // Busca tópicos quentes no Brasil para dar contexto real aos agentes
    const searchResult = await searchWeb(user, {
      query: "últimas notícias brasil hoje agora principais temas discussão",
      max_results: 3
    });

    if (!searchResult.ok) throw new Error("Search failed");

    // Seleciona um título aleatório ou compila os temas
    const topics = searchResult.results.map(r => r.title).join(" • ");
    const mainTopic = searchResult.results[0]?.title || "Novos desafios na tecnologia";

    return Response.json({
      mainTopic,
      allTopics: topics,
      snippet: searchResult.results[0]?.snippet
    });
  } catch (error) {
    console.error("[AgentRoomNews] Error:", error);
    return Response.json({ 
      mainTopic: "Discussão sobre o futuro da IA", 
      allTopics: "IA • Sociedade • Futuro" 
    });
  }
}

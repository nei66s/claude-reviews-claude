
import path from "node:path";
import OpenAI from "openai";

import type { SessionUser } from "./auth";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  date?: string;
};

type CachedEntry = {
  expiresAt: number;
  results: WebSearchResult[];
};

const cache = new Map<string, CachedEntry>();
const CACHE_TTL_MS = 30 * 60 * 1000;
const DEFAULT_MAX_RESULTS = 5;





function getCacheKey(query: string, maxResults: number) {
  return `${query.trim().toLowerCase()}::${maxResults}`;
}

function readFromCache(cacheKey: string) {
  const item = cache.get(cacheKey);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(cacheKey);
    return null;
  }
  return item.results;
}

function writeToCache(cacheKey: string, results: WebSearchResult[]) {
  cache.set(cacheKey, {
    expiresAt: Date.now() + CACHE_TTL_MS,
    results,
  });
}

function isWebSearchEnabled() {
  return process.env.ALLOW_WEB_FETCH === "true" && !!process.env.OPENAI_API_KEY;
}


async function searchWithOpenAI(query: string): Promise<WebSearchResult[]> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

  const client = new OpenAI({ apiKey });

  try {
    // Usamos o modelo especializado de busca da OpenAI para obter resultados grounded
    const response = await client.chat.completions.create({
      model: "gpt-4o-search-preview",
      messages: [
        {
          role: "user",
          content: `Pesquise sobre: ${query}. Retorne uma lista de resultados relevantes com título, URL e um pequeno resumo. Formate como uma lista de itens claros.`,
        },
      ],
      // NOTA: Não passamos 'tools' aqui para evitar o erro de modelo de busca que não aceita ferramentas
    });

    const content = response.choices[0]?.message?.content || "";
    
    // Tenta dividir o conteúdo em itens individuais para que a UI mostre a contagem correta
    const items = content.split(/\n(?=\d+\.\s+\*\*)/);
    
    if (items.length <= 1) {
      return [
        {
          title: `Busca OpenAI: ${query}`,
          url: "https://openai.com/search",
          snippet: content,
        },
      ];
    }

    return items.map((item, index) => {
      // Extrai o título (entre asteriscos)
      const titleMatch = item.match(/\d+\.\s+\*\*(.*?)\*\*/);
      const title = titleMatch ? titleMatch[1] : `Resultado ${index + 1}`;
      
      // Tenta achar uma URL no bloco
      const urlMatch = item.match(/\]\((https?:\/\/.*?)\)/) || item.match(/(https?:\/\/[^\s\)]+)/);
      const url = urlMatch ? urlMatch[1] : "https://openai.com/search";

      // O snippet é o resto do texto sem o título
      const snippet = item.replace(/\d+\.\s+\*\*(.*?)\*\*/, "").trim();

      return { title, url, snippet };
    });
  } catch (error) {
    console.error(`[WEB_SEARCH_OPENAI] Erro:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function searchWeb(
  _user: SessionUser,
  input: {
    query: string;
    max_results?: number;
  },
) {
  if (!isWebSearchEnabled()) {
    throw new Error("Web search desabilitado. Defina ALLOW_WEB_FETCH=true no .env.");
  }

  const query = String(input.query || "").trim();
  if (!query) {
    throw new Error("query required");
  }

  const maxResults = Math.min(10, Math.max(1, Number(input.max_results) || DEFAULT_MAX_RESULTS));
  const cacheKey = getCacheKey(query, maxResults);
  const cached = readFromCache(cacheKey);

  if (cached) {
    return {
      ok: true,
      cached: true,
      provider: "openai",
      query,
      results: cached,
    };
  }

  // Removemos o rate limit diário forçado para o usuário já que a OpenAI tem seus próprios limites
  const results = await searchWithOpenAI(query);
  writeToCache(cacheKey, results);

  return {
    ok: true,
    cached: false,
    provider: "openai",
    query,
    results,
  };
}

export const webSearchToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Buscar na web usando o motor de busca nativo da OpenAI.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "O termo a ser buscado." }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
} as const;

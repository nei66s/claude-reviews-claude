
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



export async function searchWeb(
  _user: SessionUser,
  input: {
    query: string;
    max_results?: number;
    filters?: {
      allowed_domains?: string[];
      blocked_domains?: string[];
    };
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

  // Configura filtros se fornecidos
  let filterPrompt = '';
  if (input.filters?.allowed_domains?.length) {
    filterPrompt = ` Limite a busca aos domínios: ${input.filters.allowed_domains.join(', ')}.`;
  } else if (input.filters?.blocked_domains?.length) {
    filterPrompt = ` Ignore os domínios: ${input.filters.blocked_domains.join(', ')}.`;
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const client = new OpenAI({ apiKey });

  // Usamos o modelo especializado de busca da OpenAI (Official Tool behavior)
  const response = await client.chat.completions.create({
    model: "gpt-4o-search-preview",
    messages: [
      {
        role: "user",
        content: `Pesquise sobre: ${query}.${filterPrompt} Retorne uma lista de resultados relevantes com título, URL e um pequeno resumo. Se houver citações diretas, inclua-as.`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || "";
  const items = content.split(/\n(?=\d+\.\s+\*\*)/);
  
  const results = items.length <= 1 
    ? [{ title: `Busca OpenAI: ${query}`, url: "https://openai.com/search", snippet: content }]
    : items.map((item, index) => {
        const titleMatch = item.match(/\d+\.\s+\*\*(.*?)\*\*/);
        const title = titleMatch ? titleMatch[1] : `Resultado ${index + 1}`;
        const urlMatch = item.match(/\]\((https?:\/\/.*?)\)/) || item.match(/(https?:\/\/[^\s\)]+)/);
        const url = urlMatch ? urlMatch[1] : "https://openai.com/search";
        const snippet = item.replace(/\d+\.\s+\*\*(.*?)\*\*/, "").trim();
        return { title, url, snippet };
      });

  writeToCache(cacheKey, results);

  return {
    ok: true,
    cached: false,
    provider: "openai",
    query,
    results,
    usage_note: "Resultados providos pelo motor de busca nativo da OpenAI.",
  };
}

export const webSearchToolDefinition = {
  type: "function",
  function: {
    name: "web_search",
    description: "Web search allows accessibility to up-to-date information from the internet and provide answers with sourced citations.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "O termo a ser buscado." },
        filters: {
          type: "object",
          properties: {
            allowed_domains: { type: "array", items: { type: "string" }, description: "Limit results to specific domains." },
            blocked_domains: { type: "array", items: { type: "string" }, description: "Exclude specific domains." }
          }
        }
      },
      required: ["query"],
      additionalProperties: false
    }
  }
} as const;

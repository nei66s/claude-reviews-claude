import fs from "node:fs/promises";
import path from "node:path";

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
const DEFAULT_DAILY_LIMIT = 25;

function getRateLimitFile() {
  return path.join(process.cwd(), ".chocks-local", "web-search-rate-limit.json");
}

async function readRateLimitState() {
  const filePath = getRateLimitFile();
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, number>) : {};
  } catch {
    return {};
  }
}

async function writeRateLimitState(state: Record<string, number>) {
  const filePath = getRateLimitFile();
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(state, null, 2), "utf8");
}

function getDayBucket() {
  return new Date().toISOString().slice(0, 10);
}

async function enforceDailyLimit(user: SessionUser) {
  const dailyLimit = Number(process.env.SEARCH_DAILY_LIMIT || DEFAULT_DAILY_LIMIT);
  const state = await readRateLimitState();
  const key = `${user.id}:${getDayBucket()}`;
  const current = state[key] || 0;

  if (current >= dailyLimit) {
    throw new Error(`Limite diário de web search atingido (${dailyLimit}/dia).`);
  }

  state[key] = current + 1;
  await writeRateLimitState(state);
}

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
  return process.env.ALLOW_WEB_FETCH === "true" && !!process.env.SEARCH_API_KEY;
}

async function searchWithSerpApi(query: string, maxResults: number) {
  const apiKey = process.env.SEARCH_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("SEARCH_API_KEY não configurada.");
  }

  const params = new URLSearchParams({
    engine: "google",
    q: query,
    num: String(maxResults),
    api_key: apiKey,
    google_domain: process.env.SEARCH_GOOGLE_DOMAIN?.trim() || "google.com",
    gl: process.env.SEARCH_REGION?.trim() || "br",
    hl: process.env.SEARCH_LANGUAGE?.trim() || "pt-br",
  });

  const url = `https://serpapi.com/search.json?${params.toString()}`;
  console.log(`[WEB_SEARCH] Buscando: "${query}" via SerpAPI...`);
  
  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[WEB_SEARCH] SerpAPI erro ${response.status}:`, errorText);
      throw new Error(`SerpAPI falhou com status ${response.status}: ${errorText.slice(0, 200)}`);
    }

    const payload = (await response.json()) as {
      organic_results?: Array<Record<string, unknown>>;
      error?: string;
    };

    if (payload.error) {
      console.error(`[WEB_SEARCH] SerpAPI retornou erro:`, payload.error);
      throw new Error(`SerpAPI error: ${payload.error}`);
    }

    console.log(`[WEB_SEARCH] ✓ Sucesso! ${payload.organic_results?.length || 0} resultados`);

    return (payload.organic_results || [])
      .slice(0, maxResults)
      .map((item) => {
        const highlighted = Array.isArray(item.snippet_highlighted_words) ? item.snippet_highlighted_words : [];
        return {
          title: typeof item.title === "string" ? item.title : "Sem título",
          url: typeof item.link === "string" ? item.link : "",
          snippet:
            typeof item.snippet === "string"
              ? item.snippet
              : typeof highlighted[0] === "string"
                ? String(highlighted[0])
                : "",
          date: typeof item.date === "string" ? item.date : undefined,
        };
      })
      .filter((item) => item.url);
  } catch (error) {
    console.error(`[WEB_SEARCH] Erro ao buscar:`, error instanceof Error ? error.message : String(error));
    throw error;
  }
}

export async function searchWeb(
  user: SessionUser,
  input: {
    query: string;
    max_results?: number;
  },
) {
  if (!isWebSearchEnabled()) {
    throw new Error("Web search desabilitado. Defina WEB_FETCH_ALLOWLIST=true no .env.");
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
      provider: "serpapi",
      query,
      results: cached,
    };
  }

  await enforceDailyLimit(user);
  const results = await searchWithSerpApi(query, maxResults);
  writeToCache(cacheKey, results);

  return {
    ok: true,
    cached: false,
    provider: "serpapi",
    query,
    results,
  };
}

export const webSearchToolDefinition = {
  type: "function",
  name: "web_search",
  description:
    "Buscar informações atuais na web quando a resposta depender de fatos recentes. Retorna resultados com título, URL, snippet e data.",
  parameters: {
    type: "object",
    properties: {
      query: { type: "string", description: "Consulta curta e objetiva para busca na web." },
      max_results: {
        type: "number",
        description: "Quantidade máxima de resultados relevantes. Padrão 5, máximo 10.",
      },
    },
    required: ["query"],
    additionalProperties: false,
  },
} as const;

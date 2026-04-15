/**
 * Exchange Rate Tools with Persistence
 * Fetches and persists exchange rates to database
 */

import type { SessionUser } from "./auth";
import { getDb, hasDatabase } from "./db";

export type ExchangeRate = {
  code: string;
  codein: string;
  name: string;
  bid: string;
  ask: string;
  varBid: string;
  pctChange: string;
  timestamp: string;
};

export type ExchangeResult = {
  ok: boolean;
  rate?: ExchangeRate;
  pair?: string;
  error?: string;
  source?: "cache" | "api";
  cachedAt?: string;
};

/**
 * Salvar cotação de câmbio no banco
 */
async function persistExchangeRate(
  conversationId: string,
  userId: string,
  pair: string,
  rate: ExchangeRate
) {
  if (!hasDatabase()) return;
  
  const db = getDb();
  try {
    await db.query(
      `INSERT INTO conversation_context (
        id, conversation_id, owner_id, context_type, key, value, expires_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7
      )
      ON CONFLICT (conversation_id, context_type, key)
      DO UPDATE SET
        value = $6,
        updated_at = NOW(),
        expires_at = $7`,
      [
        `exchange-${pair}-${Date.now()}`,
        conversationId,
        userId,
        "exchange_rate",
        pair,
        JSON.stringify(rate),
        new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24h cache
      ]
    );
  } catch (error) {
    console.error("[EXCHANGE] Erro ao persistir câmbio:", error);
  }
}

/**
 * Recuperar cotação em cache
 */
async function getCachedExchangeRate(
  conversationId: string,
  pair: string
): Promise<ExchangeRate | null> {
  if (!hasDatabase()) return null;

  const db = getDb();
  try {
    const result = await db.query(
      `SELECT value, updated_at FROM conversation_context
       WHERE conversation_id = $1
         AND context_type = 'exchange_rate'
         AND key = $2
         AND (expires_at IS NULL OR expires_at > NOW())
       LIMIT 1`,
      [conversationId, pair]
    );

    if (result.rows.length > 0) {
      console.log(`[EXCHANGE] ✓ Cache hit para ${pair}`);
      return result.rows[0].value as ExchangeRate;
    }
  } catch (error) {
    console.error("[EXCHANGE] Erro ao recuperar cache:", error);
  }

  return null;
}

/**
 * Fetch exchange rates from free API (economia.awesomeapi.com.br)
 * With database persistence
 */
export async function getExchangeRate(
  user: SessionUser,
  conversationId: string,
  input: {
    from: string;
    to: string;
  }
): Promise<ExchangeResult> {
  const from = String(input.from || "USD").toUpperCase().trim();
  const to = String(input.to || "BRL").toUpperCase().trim();
  const pair = `${from}-${to}`;

  try {
    // Tentar recuperar do cache primeiro
    const cached = await getCachedExchangeRate(conversationId, pair);
    if (cached) {
      return {
        ok: true,
        rate: cached,
        pair,
        source: "cache",
        cachedAt: new Date().toISOString(),
      };
    }

    console.log(`[EXCHANGE] Buscando taxa: ${pair}...`);

    const response = await fetch(
      `https://economia.awesomeapi.com.br/json/last/${pair}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[EXCHANGE] Erro ${response.status}:`, errorText);
      throw new Error(`API retornou status ${response.status}`);
    }

    const data = (await response.json()) as Record<string, ExchangeRate>;
    const key = pair.replace("-", "");
    const rate = data[key];

    if (!rate) {
      throw new Error(`Par ${pair} não encontrado`);
    }

    console.log(
      `[EXCHANGE] ✓ ${pair}: compra=${rate.bid}, venda=${rate.ask}`
    );

    // ✅ Persistir no banco para futuras consultas
    await persistExchangeRate(conversationId, user.id, pair, rate);

    return {
      ok: true,
      rate,
      pair,
      source: "api",
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error(`[EXCHANGE] Erro ao buscar ${pair}:`, msg);
    return {
      ok: false,
      pair,
      error: msg,
    };
  }
}

export const exchangeRateToolDefinition = {
  type: "function",
  name: "exchange_rate",
  description:
    "Obter cotação de câmbio em tempo real. Suporta USD, EUR, GBP, JPY e outras moedas para BRL (Real Brasileiro). Retorna taxa de compra (bid) e venda (ask).",
  parameters: {
    type: "object",
    properties: {
      from: {
        type: "string",
        description: "Moeda de origem (ex: USD, EUR, GBP). Padrão: USD",
      },
      to: {
        type: "string",
        description: "Moeda de destino (ex: BRL, USD). Padrão: BRL",
      },
    },
    required: [],
    additionalProperties: false,
  },
} as const;

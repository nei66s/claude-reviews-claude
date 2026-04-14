import type { SessionUser } from "./auth";

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
};

/**
 * Fetch exchange rates from free API (economia.awesomeapi.com.br)
 * Supports: USD-BRL, EUR-BRL, GBP-BRL, etc.
 */
export async function getExchangeRate(
  _user: SessionUser,
  input: {
    from: string;
    to: string;
  },
): Promise<ExchangeResult> {
  const from = String(input.from || "USD").toUpperCase().trim();
  const to = String(input.to || "BRL").toUpperCase().trim();
  const pair = `${from}-${to}`;

  try {
    console.log(`[EXCHANGE] Buscando taxa: ${pair}...`);
    
    const response = await fetch(
      `https://economia.awesomeapi.com.br/json/last/${pair}`,
      {
        method: "GET",
        headers: { Accept: "application/json" },
        cache: "no-store",
      },
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

    console.log(`[EXCHANGE] ✓ ${pair}: compra=${rate.bid}, venda=${rate.ask}`);

    return {
      ok: true,
      rate,
      pair,
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

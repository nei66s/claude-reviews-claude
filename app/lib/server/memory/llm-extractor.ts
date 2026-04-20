import OpenAI from "openai";

import type { MemoryItemType, MemorySensitivityLevel } from "./types";
import type { ExtractorInput, ExtractedCandidate } from "./extractor";

const ALLOWED_TYPES: MemoryItemType[] = ["declared_fact", "preference", "goal", "interaction_style"];
const ALLOWED_CATEGORIES = new Set(["identity", "preference", "goal", "interaction_style"]);

const MAX_INPUT_CHARS = 1200;
const MAX_CONTENT_CHARS = 180;
const MAX_NORMALIZED_CHARS = 240;

type LlmCandidateShape = {
  type?: unknown;
  category?: unknown;
  content?: unknown;
  normalizedValue?: unknown;
  confidenceScore?: unknown;
  relevanceScore?: unknown;
  sensitivityLevel?: unknown;
};

function normalizeSnippet(input: string) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s:_-]+/gu, "")
    .slice(0, MAX_NORMALIZED_CHARS);
}

function looksSensitive(text: string) {
  const normalized = String(text ?? "").toLowerCase();
  const blockedSignals = [
    "senha",
    "password",
    "token",
    "secret",
    "api key",
    "chave",
    "cpf",
    "ssn",
    "cartao",
    "cartão",
    "credit card",
    "cvv",
    "pix",
    "banco",
    "iban",
    "wallet",
    "seed phrase",
  ];
  return blockedSignals.some((s) => normalized.includes(s));
}

function clamp01(value: number, fallback: number) {
  if (!Number.isFinite(value)) return fallback;
  return Math.max(0, Math.min(1, value));
}

function coerceSensitivityLevel(input: unknown): MemorySensitivityLevel {
  const raw = typeof input === "string" ? input.trim().toLowerCase() : "";
  if (raw === "low" || raw === "medium" || raw === "high" || raw === "blocked") return raw;
  return "low";
}

function buildExtractorText(prompt: string, recentUserTexts?: string[]) {
  const parts = Array.isArray(recentUserTexts) ? recentUserTexts : [];
  const recent = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .slice(-3);
  const combined = [...recent, String(prompt || "").trim()].filter(Boolean).join("\n");
  return combined.slice(0, MAX_INPUT_CHARS);
}

function buildSystemPrompt() {
  return [
    "Você é um extractor de memória do usuário para um sistema de memória pessoal e auditável.",
    "Tarefa: sugerir APENAS memórias duráveis e úteis do USUÁRIO (não do assistente).",
    "",
    "REGRAS DE OURO (CRÍTICO):",
    "- EXTRAIA APENAS fatos sobre a PESSOA do usuário (identidade, história pessoal, preferências, objetivos, estilo de trabalho).",
    "- IGNORE COMPLETAMENTE fatos de conhecimento geral, história, ciência, notícias ou curiosidades que o usuário esteja discutindo ou perguntando.",
    "- Se o usuário fizer uma PERGUNTA informativa (ex: 'Quem foi Saul?'), NÃO extraia o conteúdo da pergunta como um fato dele.",
    "- NÃO faça inferências psicológicas ou suposições. Use apenas o que foi declarado explicitamente sobre ele.",
    "- Ignore detalhes operacionais (ex: 'baixe o arquivo x') ou efêmeros.",
    "- Se houver dado sensível (senha, cpf, cartão etc), NÃO extraia e marque como sensitivityLevel=\"blocked\".",
    "",
    "Categorias Permitidas:",
    "- identity (nome, profissão, local onde mora, fatos biográficos)",
    "- preference (gostos, desgostos, o que prefere em respostas)",
    "- goal (objetivos de longo prazo ou desejos expressos)",
    "- interaction_style (como ele quer que você se comporte)",
    "",
    "SAÍDA:",
    "Retorne SOMENTE JSON válido no formato: {\"candidates\":[{\"type\":...,\"category\":...,\"content\":...,\"normalizedValue\":...,\"confidenceScore\":0..1,\"relevanceScore\":0..1,\"sensitivityLevel\":\"low|medium|high|blocked\"}]}",
    "Limite: no máximo 5 candidatos.",
  ].join("\n");
}

function extractOutputText(response: Record<string, unknown>) {
  const direct = typeof response.output_text === "string" ? response.output_text : "";
  if (direct.trim()) return direct.trim();

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "message" || !Array.isArray(record.content)) continue;
    const content = record.content as Array<Record<string, unknown>>;
    const textItem = content.find((entry) => entry.type === "output_text" && typeof entry.text === "string");
    if (textItem && typeof textItem.text === "string" && textItem.text.trim()) {
      return textItem.text.trim();
    }
  }

  return "";
}

function normalizeCategory(type: MemoryItemType, categoryRaw: string) {
  const normalized = categoryRaw.trim().toLowerCase();
  if (normalized === "response_style") return "interaction_style";
  if (ALLOWED_CATEGORIES.has(normalized)) return normalized;

  // Coerência mínima: se não vier categoria válida, derive do type.
  if (type === "declared_fact") return "identity";
  if (type === "preference") return "preference";
  if (type === "goal") return "goal";
  return "interaction_style";
}

function coerceType(value: unknown): MemoryItemType | null {
  const raw = typeof value === "string" ? value.trim() : "";
  if (!raw) return null;
  const normalized = raw.toLowerCase() as MemoryItemType;
  return ALLOWED_TYPES.includes(normalized) ? normalized : null;
}

function toCandidate(
  item: LlmCandidateShape,
  input: ExtractorInput,
): { candidate: ExtractedCandidate | null; discarded: boolean } {
  const type = coerceType(item.type);
  if (!type) return { candidate: null, discarded: true };

  const contentRaw = typeof item.content === "string" ? item.content.trim() : "";
  const content = contentRaw.replace(/\s+/g, " ").slice(0, MAX_CONTENT_CHARS);
  if (!content) return { candidate: null, discarded: true };
  if (looksSensitive(content)) return { candidate: null, discarded: true };

  const sensitivityLevel = coerceSensitivityLevel(item.sensitivityLevel);
  if (sensitivityLevel === "blocked") return { candidate: null, discarded: true };

  const normalizedValueRaw =
    typeof item.normalizedValue === "string" ? item.normalizedValue.trim() : "";
  let normalizedValue = (normalizedValueRaw || `${type}:${normalizeSnippet(content)}`).slice(0, MAX_NORMALIZED_CHARS);
  if (
    type === "declared_fact" &&
    /^\d{4}-\d{2}-\d{2}$/.test(normalizedValue) &&
    /\b(nasci|nascimento|data de nascimento|anivers[aá]rio)\b/i.test(content)
  ) {
    normalizedValue = `birthdate:${normalizedValue}`.slice(0, MAX_NORMALIZED_CHARS);
  }
  if (!normalizedValue) return { candidate: null, discarded: true };
  if (looksSensitive(normalizedValue)) return { candidate: null, discarded: true };

  const categoryRaw = typeof item.category === "string" ? item.category : "";
  const category = normalizeCategory(type, categoryRaw);

  const confidenceScore = clamp01(Number(item.confidenceScore), 0.6);
  const relevanceScore = clamp01(Number(item.relevanceScore), 0.6);

  return {
    candidate: {
      type,
      category,
      content,
      normalizedValue,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId ?? null,
      confidenceScore,
      relevanceScore,
      sensitivityLevel,
      status: "candidate",
      validFrom: null,
      validUntil: null,
      createdBy: "llm_extractor_v1",
    },
    discarded: false,
  };
}

function dedupeCandidates(items: ExtractedCandidate[]) {
  const seen = new Set<string>();
  const out: ExtractedCandidate[] = [];
  for (const item of items) {
    const key = `${item.type}|${item.normalizedValue}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out;
}

export type LlmExtractionResult = {
  candidates: ExtractedCandidate[];
  acceptedCount: number;
  discardedCount: number;
  rawCount: number;
};

export async function extractLlmAssistedMemoryCandidates(params: {
  apiKey: string;
  model: string;
  input: ExtractorInput;
  maxAccepted?: number;
}): Promise<LlmExtractionResult> {
  const maxAccepted = Number.isFinite(params.maxAccepted as number)
    ? Math.max(0, Math.min(5, Math.floor(params.maxAccepted as number)))
    : 3;

  const prompt = String(params.input.userPrompt ?? "").trim();
  const text = buildExtractorText(prompt, params.input.recentUserTexts);
  if (!text.trim()) {
    return { candidates: [], acceptedCount: 0, discardedCount: 0, rawCount: 0 };
  }
  // Guardrail: se o input parecer sensível, nem roda o LLM.
  if (looksSensitive(text)) {
    return { candidates: [], acceptedCount: 0, discardedCount: 0, rawCount: 0 };
  }

  const client = new OpenAI({ apiKey: params.apiKey });
  const systemPrompt = buildSystemPrompt();
  const userPrompt = `Texto do usuário (recente + mensagem atual):\n${text}`;

  const response = await client.responses.create({
    model: params.model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: systemPrompt }],
      },
      {
        role: "user",
        content: [{ type: "input_text", text: userPrompt }],
      },
    ],
    temperature: 0,
    max_output_tokens: 450,
  });

  const outputText = extractOutputText(response as unknown as Record<string, unknown>);
  if (!outputText) {
    return { candidates: [], acceptedCount: 0, discardedCount: 0, rawCount: 0 };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(outputText);
  } catch {
    return { candidates: [], acceptedCount: 0, discardedCount: 0, rawCount: 0 };
  }

  const record = (parsed ?? {}) as Record<string, unknown>;
  const rawCandidates = Array.isArray(record.candidates) ? (record.candidates as unknown[]) : [];

  const accepted: ExtractedCandidate[] = [];
  let discardedCount = 0;

  for (const raw of rawCandidates) {
    if (!raw || typeof raw !== "object") {
      discardedCount += 1;
      continue;
    }

    const { candidate, discarded } = toCandidate(raw as LlmCandidateShape, params.input);
    if (discarded || !candidate) {
      discardedCount += 1;
      continue;
    }
    accepted.push(candidate);
  }

  const deduped = dedupeCandidates(accepted);
  const limited = deduped.slice(0, maxAccepted);

  discardedCount += Math.max(0, deduped.length - limited.length);

  return {
    candidates: limited,
    acceptedCount: limited.length,
    discardedCount,
    rawCount: rawCandidates.length,
  };
}

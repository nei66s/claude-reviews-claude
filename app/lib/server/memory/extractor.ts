import type { CreateUserMemoryItemInput, MemoryItemType } from "./types";

export type ExtractorInput = {
  sourceConversationId: string;
  sourceMessageId?: number | null;
  userPrompt: string;
  recentUserTexts?: string[];
  createdBy?: string;
};

export type ExtractedCandidate = Omit<CreateUserMemoryItemInput, "id" | "userId">;

function normalizeSnippet(input: string) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[^\p{L}\p{N}\s:_-]+/gu, "")
    .slice(0, 240);
}

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function parseBirthdate(text: string): { iso: string; display: string } | null {
  const match =
    text.match(
      /\b(?:nasci(?:\s+dia)?|nascimento|data de nascimento|anivers[aá]rio)\s*(?:em|:)?\s*(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/i,
    ) ?? text.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);

  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;

  const iso = `${year}-${pad2(month)}-${pad2(day)}`;
  const display = `${pad2(day)}/${pad2(month)}/${year}`;
  return { iso, display };
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

function pushUnique(out: ExtractedCandidate[], candidate: ExtractedCandidate) {
  const key = `${candidate.type}|${candidate.normalizedValue}`.toLowerCase();
  if (out.some((existing) => `${existing.type}|${existing.normalizedValue}`.toLowerCase() === key)) {
    return;
  }
  out.push(candidate);
}

function classifyInteractionStyle(prompt: string): string[] {
  const out: string[] = [];
  const normalized = prompt.toLowerCase();

  if (/(responda|responde)\s+em\s+(portugu[eê]s|pt-br|portugu[êe]s do brasil)/i.test(prompt)) {
    out.push("Responder em pt-BR");
  }
  if (/(seja|responda)\s+(curto|curta|direto|direta|objetivo|objetiva)/i.test(prompt)) {
    out.push("Respostas curtas e diretas");
  }
  if (/(seja|responda)\s+(detalhado|detalhada|com detalhes|mais detalhado)/i.test(prompt)) {
    out.push("Respostas detalhadas");
  }
  if (/(use|organize)\s+(lista|listas|bullet)/i.test(prompt)) {
    out.push("Preferir respostas em lista");
  }
  if (normalized.includes("sem emoji") || normalized.includes("sem emojis")) {
    out.push("Sem emojis");
  }

  return out;
}

function buildExtractorText(prompt: string, recentUserTexts?: string[]) {
  const parts = Array.isArray(recentUserTexts) ? recentUserTexts : [];
  const recent = parts
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .slice(-3);
  const combined = [...recent, String(prompt || "").trim()].filter(Boolean).join("\n");
  // Keep bounded for safety/cost.
  return combined.slice(0, 1200);
}

export function extractDeterministicMemoryCandidates(input: ExtractorInput): ExtractedCandidate[] {
  const prompt = String(input.userPrompt ?? "").trim();
  const text = buildExtractorText(prompt, input.recentUserTexts);
  if (!text.trim()) return [];
  if (looksSensitive(text)) return [];

  const candidates: ExtractedCandidate[] = [];

  // declared_fact — nome (alto sinal e baixo risco)
  const nameMatch =
    text.match(/\bmeu nome\s*(?:é|e)\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,60})/i) ||
    text.match(/\bme chamo\s+([A-Za-zÀ-ÿ][A-Za-zÀ-ÿ' -]{1,60})/i);
  if (nameMatch?.[1]) {
    const name = nameMatch[1].trim().replace(/\s+/g, " ").slice(0, 60);
    pushUnique(candidates, {
      type: "declared_fact",
      category: "identity",
      content: `Nome: ${name}`,
      normalizedValue: `name:${normalizeSnippet(name)}`,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId ?? null,
      confidenceScore: 0.95,
      relevanceScore: 0.9,
      sensitivityLevel: "low",
      status: "candidate",
      validFrom: null,
      validUntil: null,
      createdBy: input.createdBy ?? "chat_extractor_v1",
    });
  }

  // declared_fact — data de nascimento (normalização estável)
  const birthdate = parseBirthdate(text);
  if (birthdate && !looksSensitive(birthdate.iso)) {
    pushUnique(candidates, {
      type: "declared_fact",
      category: "identity",
      content: `Nascimento: ${birthdate.display}`,
      normalizedValue: `birthdate:${birthdate.iso}`,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId ?? null,
      confidenceScore: 0.9,
      relevanceScore: 0.85,
      sensitivityLevel: "low",
      status: "candidate",
      validFrom: null,
      validUntil: null,
      createdBy: input.createdBy ?? "chat_extractor_v1",
    });
  }

  // goal — "quero ..." / "preciso ..."
  const goalMatch = text.match(/\b(quero|preciso|meu objetivo(?:\s+é|:)?|objetivo:)\s+(.{6,180})/i);
  if (goalMatch?.[2]) {
    const goal = goalMatch[2].trim().replace(/\s+/g, " ").replace(/[.?!].*$/, "").slice(0, 180);
    if (!looksSensitive(goal)) {
      pushUnique(candidates, {
        type: "goal",
        category: "goal",
        content: goal,
        normalizedValue: `goal:${normalizeSnippet(goal)}`,
        sourceConversationId: input.sourceConversationId,
        sourceMessageId: input.sourceMessageId ?? null,
        confidenceScore: 0.75,
        relevanceScore: 0.7,
        sensitivityLevel: "low",
        status: "candidate",
        validFrom: null,
        validUntil: null,
        createdBy: input.createdBy ?? "chat_extractor_v1",
      });
    }
  }

  // preference — "prefiro ..." / "gosto de ..." (não confundir com estilo)
  const prefMatch = text.match(/\b(prefiro|gosto de|não gosto de|nao gosto de)\s+(.{6,180})/i);
  if (prefMatch?.[2]) {
    const pref = prefMatch[2].trim().replace(/\s+/g, " ").replace(/[.?!].*$/, "").slice(0, 180);
    if (!looksSensitive(pref)) {
      pushUnique(candidates, {
        type: "preference",
        category: "preference",
        content: pref,
        normalizedValue: `pref:${normalizeSnippet(pref)}`,
        sourceConversationId: input.sourceConversationId,
        sourceMessageId: input.sourceMessageId ?? null,
        confidenceScore: 0.7,
        relevanceScore: 0.6,
        sensitivityLevel: "low",
        status: "candidate",
        validFrom: null,
        validUntil: null,
        createdBy: input.createdBy ?? "chat_extractor_v1",
      });
    }
  }

  // interaction_style — instruções explícitas sobre como responder
  const styleHints = classifyInteractionStyle(text);
  for (const hint of styleHints.slice(0, 3)) {
    pushUnique(candidates, {
      type: "interaction_style",
      category: "interaction_style",
      content: hint,
      normalizedValue: `style:${normalizeSnippet(hint)}`,
      sourceConversationId: input.sourceConversationId,
      sourceMessageId: input.sourceMessageId ?? null,
      confidenceScore: 0.8,
      relevanceScore: 0.8,
      sensitivityLevel: "low",
      status: "candidate",
      validFrom: null,
      validUntil: null,
      createdBy: input.createdBy ?? "chat_extractor_v1",
    });
  }

  // Guardrail: limitar volume e manter só os tipos pedidos para esta etapa.
  const allowedTypes: MemoryItemType[] = ["declared_fact", "preference", "goal", "interaction_style"];
  return candidates.filter((c) => allowedTypes.includes(c.type)).slice(0, 5);
}

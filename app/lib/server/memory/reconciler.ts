import type { CreateUserMemoryItemInput, MemoryItemType, UserMemoryItem } from "./types";
import { findActiveUserMemoryItemByDedupeKey, findActiveUserMemoryItemsByNormalizedValue } from "./repository";

type ReconcilerDecision =
  | { kind: "skip_duplicate"; candidate: CreateUserMemoryItemInput; reason: string }
  | { kind: "insert_active"; candidate: CreateUserMemoryItemInput; reason: string; contradictExistingIds: string[] }
  | { kind: "insert_contradicted"; candidate: CreateUserMemoryItemInput; reason: string };

const TYPE_PRIORITY: Record<MemoryItemType, number> = {
  declared_fact: 6,
  preference: 5,
  goal: 5,
  constraint: 5,
  interaction_style: 5,
  inferred_trait: 1,
};

function normalizeValue(input: string) {
  return String(input ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 400);
}

function isHigherPriority(a: MemoryItemType, b: MemoryItemType) {
  return (TYPE_PRIORITY[a] ?? 0) > (TYPE_PRIORITY[b] ?? 0);
}

function coerceNormalizedValue(candidate: CreateUserMemoryItemInput) {
  const fromInput = String(candidate.normalizedValue ?? "").trim();
  if (fromInput) return normalizeValue(fromInput);
  return normalizeValue(candidate.content);
}

function shouldCandidateBeBlockedByExisting(candidateType: MemoryItemType, existing: UserMemoryItem) {
  // Inferência nunca contradiz/promove sobre fatos/preferências/etc já ativos.
  if (candidateType === "inferred_trait" && existing.type !== "inferred_trait") return true;
  // Fato declarado tem prioridade máxima: não aceitamos inferência/preferência/etc tentando "substituir" automaticamente.
  if (existing.type === "declared_fact" && candidateType !== "declared_fact") return true;
  // Para outros tipos de alta prioridade, mantemos simples: não tentamos sobrescrever automaticamente.
  if (!isHigherPriority(candidateType, existing.type) && existing.type !== candidateType) return true;
  return false;
}

export async function reconcileCandidates(
  candidates: CreateUserMemoryItemInput[],
  deps?: { findActiveByDedupeKey?: typeof findActiveUserMemoryItemByDedupeKey; findActiveByValue?: typeof findActiveUserMemoryItemsByNormalizedValue },
): Promise<ReconcilerDecision[]> {
  const findActiveByDedupeKey = deps?.findActiveByDedupeKey ?? findActiveUserMemoryItemByDedupeKey;
  const findActiveByValue = deps?.findActiveByValue ?? findActiveUserMemoryItemsByNormalizedValue;

  const decisions: ReconcilerDecision[] = [];

  for (const candidate of candidates) {
    const normalizedValue = coerceNormalizedValue(candidate);
    const typedCandidate: CreateUserMemoryItemInput = {
      ...candidate,
      normalizedValue,
      status: "candidate",
    };

    const existingSameType = await findActiveByDedupeKey(
      typedCandidate.userId,
      typedCandidate.type,
      normalizedValue,
    );

    if (existingSameType) {
      decisions.push({
        kind: "skip_duplicate",
        candidate: typedCandidate,
        reason: "existing active item with same (user_id,type,normalized_value)",
      });
      continue;
    }

    const existingWithSameValue = await findActiveByValue(typedCandidate.userId, normalizedValue);
    const blockers = existingWithSameValue.filter((item) => shouldCandidateBeBlockedByExisting(typedCandidate.type, item));

    if (blockers.length > 0) {
      decisions.push({
        kind: "insert_contradicted",
        candidate: { ...typedCandidate, status: "contradicted" },
        reason: `blocked by existing active item(s): ${blockers.map((b) => `${b.type}:${b.id}`).join(", ")}`,
      });
      continue;
    }

    const contradictExistingIds = existingWithSameValue
      .filter((item) => isHigherPriority(typedCandidate.type, item.type))
      .map((item) => item.id);

    decisions.push({
      kind: "insert_active",
      candidate: { ...typedCandidate, status: "active" },
      reason: candidate.reason || "no blocking conflicts found; promoting to active",
      contradictExistingIds,
    });
  }

  return decisions;
}


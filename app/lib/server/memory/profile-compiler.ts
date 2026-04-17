import type { MemoryItemType, UpsertUserProfileInput, UserMemoryItem, UserProfile } from "./types";
import { getUserProfile, listUserMemoryItemsByUserId, upsertUserProfile } from "./repository";

function pad2(value: number) {
  return String(value).padStart(2, "0");
}

function isoToPtBrDate(iso: string): string | null {
  const match = String(iso || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function extractBirthdateDisplay(item: Pick<UserMemoryItem, "content" | "normalizedValue">): string | null {
  const normalizedValue = String(item.normalizedValue || "").trim();
  const prefixed = normalizedValue.match(/^birthdate:(\d{4}-\d{2}-\d{2})$/i);
  if (prefixed?.[1]) {
    return isoToPtBrDate(prefixed[1]);
  }

  // Compat: versões antigas podem ter salvo apenas YYYY-MM-DD.
  const legacyIso = normalizedValue.match(/^(\d{4}-\d{2}-\d{2})$/);
  if (legacyIso?.[1]) {
    return isoToPtBrDate(legacyIso[1]);
  }

  const content = String(item.content || "");
  const match = content.match(/\b(\d{2})[\/\-](\d{2})[\/\-](\d{4})\b/);
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]);
  const year = Number(match[3]);
  if (!Number.isFinite(day) || !Number.isFinite(month) || !Number.isFinite(year)) return null;
  if (year < 1900 || year > 2100) return null;
  if (month < 1 || month > 12) return null;
  if (day < 1 || day > 31) return null;
  return `${pad2(day)}/${pad2(month)}/${year}`;
}

function formatDeclaredFact(item: Pick<UserMemoryItem, "content" | "normalizedValue">) {
  const birthdate = extractBirthdateDisplay(item);
  if (birthdate) return `Nascimento: ${birthdate}`;
  return String(item.content || "").trim();
}

function toBulletLines(items: string[], limit: number) {
  return items
    .filter((item) => String(item || "").trim())
    .slice(0, limit)
    .map((item) => `- ${String(item).trim()}`)
    .join("\n");
}

function groupByType(items: UserMemoryItem[]) {
  const groups = new Map<MemoryItemType, UserMemoryItem[]>();
  for (const item of items) {
    const arr = groups.get(item.type) ?? [];
    arr.push(item);
    groups.set(item.type, arr);
  }
  return groups;
}

function uniqStrings(values: string[]) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const raw of values) {
    const normalized = String(raw || "").trim();
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalized);
  }
  return out;
}

export async function compileUserProfileFromActiveMemory(
  userId: string,
  db?: Parameters<typeof listUserMemoryItemsByUserId>[2],
): Promise<UserProfile> {
  const active = await listUserMemoryItemsByUserId(userId, { status: "active", limit: 500 }, db);
  const existingProfile = await getUserProfile(userId, db);

  const groups = groupByType(active);

  const declaredFacts = groups.get("declared_fact") ?? [];
  const facts = declaredFacts.map((i) => formatDeclaredFact(i));
  const inferred = (groups.get("inferred_trait") ?? []).map((i) => i.content);
  const preferences = (groups.get("preference") ?? []).map((i) => i.content);
  const goals = (groups.get("goal") ?? []).map((i) => i.content);
  const constraints = (groups.get("constraint") ?? []).map((i) => i.content);
  const style = (groups.get("interaction_style") ?? []).map((i) => i.content);

  // keyFacts deve priorizar itens "altamente declarativos" e úteis para contexto,
  // sem deixar inferências dominarem os campos principais.
  const keyFacts = uniqStrings([
    ...facts,
    ...constraints.map((c) => `Restrição: ${c}`),
    ...preferences.map((p) => `Preferência: ${p}`),
    ...style.map((s) => `Estilo: ${s}`),
  ]).slice(0, 20);
  const activeGoals = uniqStrings(goals).slice(0, 20);
  const knownConstraints = uniqStrings(constraints).slice(0, 20);

  const interactionPreferences: Record<string, unknown> = {
    interaction_style: uniqStrings(style).slice(0, 10),
    preferences: uniqStrings(preferences).slice(0, 20),
  };

  // Recurring topics: heurística mínima usando category (quando preenchido).
  const categoryCounts = new Map<string, number>();
  for (const item of active) {
    const category = String(item.category || "").trim();
    if (!category) continue;
    const key = category.toLowerCase();
    categoryCounts.set(key, (categoryCounts.get(key) ?? 0) + 1);
  }
  const recurringTopics = [...categoryCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([category]) => category);

  const summaryParts: string[] = [];
  const seenSummary = new Set<string>();
  const pushSummary = (value: string) => {
    const trimmed = String(value || "").trim();
    if (!trimmed) return;
    const key = trimmed.toLowerCase();
    if (seenSummary.has(key)) return;
    seenSummary.add(key);
    summaryParts.push(trimmed);
  };

  const nameFact = facts.find((f) => /^nome:\s*/i.test(f)) ?? null;
  if (nameFact) pushSummary(nameFact);

  const birthdateFact = facts.find((f) => /^nascimento:\s*/i.test(f)) ?? null;
  if (birthdateFact) pushSummary(birthdateFact);

  const preference = uniqStrings(preferences)[0] ?? null;
  const stylePref = uniqStrings(style)[0] ?? null;
  if (preference) pushSummary(preference.toLowerCase().startsWith("preferência:") ? preference : `Preferência: ${preference}`);
  else if (stylePref) pushSummary(`Preferência: ${stylePref}`);

  const goal = activeGoals[0] ?? null;
  if (goal) pushSummary(`Objetivo: ${goal}`);

  if (summaryParts.length === 0) {
    for (const fact of keyFacts) {
      pushSummary(fact);
      if (summaryParts.length >= 3) break;
    }
  }

  const summaryShort = summaryParts.join(" • ").slice(0, 240).trim();

  const summaryLong = [
    `# Perfil do usuário`,
    "",
    keyFacts.length ? `## Fatos e traços` : "",
    keyFacts.length ? toBulletLines(keyFacts, 20) : "",
    inferred.length ? `\n## Inferências (não confirmadas)` : "",
    inferred.length ? toBulletLines(uniqStrings(inferred), 20) : "",
    activeGoals.length ? `\n## Objetivos` : "",
    activeGoals.length ? toBulletLines(activeGoals, 20) : "",
    knownConstraints.length ? `\n## Restrições` : "",
    knownConstraints.length ? toBulletLines(knownConstraints, 20) : "",
    preferences.length ? `\n## Preferências` : "",
    preferences.length ? toBulletLines(uniqStrings(preferences), 20) : "",
  ]
    .filter(Boolean)
    .join("\n")
    .trim();

  const nextVersion = (existingProfile?.profileVersion ?? 0) + 1;
  const lastCompiledAt = new Date().toISOString();

  const upsertInput: UpsertUserProfileInput = {
    userId,
    summaryShort,
    summaryLong,
    interactionPreferences,
    recurringTopics,
    activeGoals,
    knownConstraints,
    keyFacts,
    profileVersion: nextVersion,
    lastCompiledAt,
  };

  return upsertUserProfile(upsertInput, db);
}

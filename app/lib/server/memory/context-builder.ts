import { getUserProfile, listUserMemoryItemsByUserId } from "./repository";
import type { BuildContextInput, ContextPack, MemoryItemType, UserMemoryItem } from "./types";


const DEFAULT_INCLUDED_TYPES: MemoryItemType[] = [
  "declared_fact",
  "constraint",
  "goal",
  "preference",
  "interaction_style",
];

const AGENT_PRIORITIES: Record<string, { types?: MemoryItemType[]; categories?: string[] }> = {
  coder: {
    types: ["constraint", "preference"],
    categories: ["coding", "stack", "tech", "development"],
  },
  "doutora-kitty": {
    types: ["preference", "interaction_style", "inferred_trait"],
    categories: ["personality", "psychological", "tone", "style"],
  },
};

const TASK_PRIORITIES: Record<string, MemoryItemType[]> = {
  chat: ["preference", "interaction_style", "declared_fact"],
  task: ["goal", "constraint", "declared_fact"],
};

function scoreItem(item: UserMemoryItem, input: BuildContextInput): number {
  let score = 0;

  // 1. Boost by Agent Type
  if (input.agentType) {
    const p = AGENT_PRIORITIES[input.agentType];
    if (p) {
      if (p.types?.includes(item.type)) score += 5;
      if (p.categories?.some((cat) => item.category?.toLowerCase().includes(cat.toLowerCase()))) score += 10;
    }
  }

  // 2. Boost by Task Type
  if (input.taskType) {
    const p = TASK_PRIORITIES[input.taskType];
    if (p?.includes(item.type)) score += 3;
  }

  // 3. Boost by Keyword Match (if query provided)
  if (input.query) {
    const query = input.query.toLowerCase();
    const content = item.content.toLowerCase();
    const category = item.category?.toLowerCase() || "";
    const words = query.split(/\s+/).filter((w) => w.length > 3);

    for (const word of words) {
      if (content.includes(word)) score += 2;
      if (category.includes(word)) score += 5;
    }
  }

  // 4. Boost by explicit priorities
  if (input.priorityCategories?.some((cat) => item.category?.toLowerCase().includes(cat.toLowerCase()))) {
    score += 15;
  }

  return score;
}

export async function buildContextPack(input: BuildContextInput): Promise<ContextPack> {
  const limit = Number.isFinite(input.limitItems as number) ? Math.max(1, Math.min(30, input.limitItems as number)) : 12;
  const includeTypes = input.includeTypes?.length ? input.includeTypes : DEFAULT_INCLUDED_TYPES;

  const [profile, activeItems] = await Promise.all([
    getUserProfile(input.userId),
    listUserMemoryItemsByUserId(input.userId, { status: "active", limit: 200 }),
  ]);

  // Scoring and sorting
  const scored = activeItems
    .filter((item) => includeTypes.includes(item.type))
    .filter((item) => item.sensitivityLevel === "low" || item.sensitivityLevel === "medium")
    .map((item) => ({ item, score: scoreItem(item, input) }));

  // Sort by score desc, then by date desc (date is already sorted in repository)
  scored.sort((a, b) => b.score - a.score);

  const filtered = scored.slice(0, limit).map((s) => s.item);

  return {
    userId: input.userId,
    summaryShort: profile?.summaryShort ?? "",
    summaryLong: profile?.summaryLong ?? "",
    keyFacts: profile?.keyFacts ?? [],
    activeGoals: profile?.activeGoals ?? [],
    interactionPreferences: profile?.interactionPreferences ?? {},
    knownConstraints: profile?.knownConstraints ?? [],
    memoryItems: filtered.map((item) => ({
      id: item.id,
      type: item.type,
      category: item.category,
      content: item.content,
      normalizedValue: item.normalizedValue,
      sensitivityLevel: item.sensitivityLevel,
    })),
  };
}

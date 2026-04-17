import type { MemoryItemType, UserMemoryItem } from "./types";
import { getUserProfile, listUserMemoryItemsByUserId } from "./repository";

export type ContextPack = {
  userId: string;
  summaryShort: string;
  keyFacts: unknown[];
  activeGoals: unknown[];
  interactionPreferences: Record<string, unknown>;
  knownConstraints: unknown[];
  memoryItems: Array<Pick<UserMemoryItem, "id" | "type" | "category" | "content" | "normalizedValue" | "sensitivityLevel">>;
};

export type BuildContextInput = {
  userId: string;
  agentType?: string;
  taskType?: string;
  limitItems?: number;
  includeTypes?: MemoryItemType[];
};

const DEFAULT_INCLUDED_TYPES: MemoryItemType[] = [
  "declared_fact",
  "constraint",
  "goal",
  "preference",
  "interaction_style",
];

export async function buildContextPack(input: BuildContextInput): Promise<ContextPack> {
  const limit = Number.isFinite(input.limitItems as number) ? Math.max(1, Math.min(30, input.limitItems as number)) : 12;
  const includeTypes = input.includeTypes?.length ? input.includeTypes : DEFAULT_INCLUDED_TYPES;

  const [profile, activeItems] = await Promise.all([
    getUserProfile(input.userId),
    listUserMemoryItemsByUserId(input.userId, { status: "active", limit: 200 }),
  ]);

  const filtered = activeItems.filter((item) => includeTypes.includes(item.type)).slice(0, limit);

  return {
    userId: input.userId,
    summaryShort: profile?.summaryShort ?? "",
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

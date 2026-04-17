import {
  MEMORY_AUDIT_ACTIONS,
  MEMORY_ITEM_STATUSES,
  MEMORY_ITEM_TYPES,
  MEMORY_SENSITIVITY_LEVELS,
} from "./constants";

export type MemoryItemType = (typeof MEMORY_ITEM_TYPES)[number];
export type MemoryItemStatus = (typeof MEMORY_ITEM_STATUSES)[number];
export type MemoryAuditAction = (typeof MEMORY_AUDIT_ACTIONS)[number];
export type MemorySensitivityLevel = (typeof MEMORY_SENSITIVITY_LEVELS)[number];

export type UserMemoryItem = {
  id: string;
  userId: string;
  type: MemoryItemType;
  category: string;
  content: string;
  normalizedValue: string;
  sourceConversationId: string;
  sourceMessageId: number | null;
  confidenceScore: number;
  relevanceScore: number;
  sensitivityLevel: MemorySensitivityLevel;
  status: MemoryItemStatus;
  validFrom: string | null;
  validUntil: string | null;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateUserMemoryItemInput = {
  id: string;
  userId: string;
  type: MemoryItemType;
  category?: string;
  content: string;
  normalizedValue?: string;
  sourceConversationId: string;
  sourceMessageId?: number | null;
  confidenceScore?: number;
  relevanceScore?: number;
  sensitivityLevel?: MemorySensitivityLevel;
  status?: MemoryItemStatus;
  validFrom?: string | null;
  validUntil?: string | null;
  createdBy?: string;
};

export type UserProfile = {
  userId: string;
  summaryShort: string;
  summaryLong: string;
  interactionPreferences: Record<string, unknown>;
  recurringTopics: unknown[];
  activeGoals: unknown[];
  knownConstraints: unknown[];
  keyFacts: unknown[];
  profileVersion: number;
  lastCompiledAt: string | null;
  updatedAt: string;
};

export type UpsertUserProfileInput = {
  userId: string;
  summaryShort?: string;
  summaryLong?: string;
  interactionPreferences?: Record<string, unknown>;
  recurringTopics?: unknown[];
  activeGoals?: unknown[];
  knownConstraints?: unknown[];
  keyFacts?: unknown[];
  profileVersion?: number;
  lastCompiledAt?: string | null;
};

export type MemoryAuditLogEntry = {
  id: number;
  memoryItemId: string;
  userId: string;
  action: MemoryAuditAction;
  previousStatus: MemoryItemStatus | null;
  newStatus: MemoryItemStatus | null;
  reason: string;
  actor: string;
  createdAt: string;
};

export type CreateMemoryAuditLogEntryInput = {
  memoryItemId: string;
  userId: string;
  action: MemoryAuditAction;
  previousStatus?: MemoryItemStatus | null;
  newStatus?: MemoryItemStatus | null;
  reason?: string;
  actor?: string;
};

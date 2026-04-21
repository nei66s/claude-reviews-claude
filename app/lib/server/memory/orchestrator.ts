import crypto from "node:crypto";

import type {
  CreateMemoryAuditLogEntryInput,
  CreateUserMemoryItemInput,
  MemoryAuditAction,
  MemoryItemStatus,
  UserMemoryItem,
  UserProfile,
} from "./types";
import {
  insertMemoryAuditLogEntry,
  insertUserMemoryItem,
  getUserMemoryItemById,
  updateUserMemoryItemStatus,
  updateUserMemoryItemFields,
  withMemoryTransaction,
  getIngestionLogByMessageId,
  insertIngestionLog,
  countRecentIngestions,
} from "./repository";
import { reconcileCandidates } from "./reconciler";
import { compileUserProfileFromActiveMemory } from "./profile-compiler";

export type OrchestrateCandidatesInput = {
  userId: string;
  candidates: Array<Omit<CreateUserMemoryItemInput, "userId" | "status" | "id"> & { userId?: string; status?: MemoryItemStatus; id?: string }>;
  actor?: string;
  reason?: string;
  compileProfile?: boolean;
};

export type OrchestrateResult = {
  userId: string;
  inserted: { active: number; contradicted: number; candidate: number };
  skippedDuplicates: number;
  updatedExisting: { contradicted: number };
  auditEntries: number;
  profileCompiled: boolean;
  profile?: UserProfile;
  items: {
    inserted: UserMemoryItem[];
    updated: UserMemoryItem[];
  };
};

export type ManualMemoryItemChangeInput = {
  userId: string;
  memoryItemId: string;
  actor: string;
  reason?: string;
  status?: MemoryItemStatus;
  content?: string;
  normalizedValue?: string;
  category?: string;
};

function actionForManualChange(
  previousStatus: MemoryItemStatus,
  nextStatus: MemoryItemStatus | null,
  contentChanged: boolean,
): MemoryAuditAction {
  if (nextStatus && nextStatus !== previousStatus) {
    if (nextStatus === "active") return "promoted";
    if (nextStatus === "archived") return "archived";
    if (nextStatus === "contradicted") return "contradicted";
    if (nextStatus === "deleted") return "deleted";
  }
  return contentChanged ? "updated" : "updated";
}

export async function applyManualMemoryItemChange(input: ManualMemoryItemChangeInput) {
  const reason = input.reason ?? "";

  return withMemoryTransaction(async (db) => {
    const existing = await getUserMemoryItemById(input.userId, input.memoryItemId, db);
    if (!existing) {
      throw new Error("Memory item not found.");
    }

    const wantsFieldUpdate =
      input.category !== undefined || input.content !== undefined || input.normalizedValue !== undefined;
    const wantsStatusUpdate = input.status !== undefined && input.status !== existing.status;

    let updated = existing;

    if (wantsFieldUpdate) {
      const next = await updateUserMemoryItemFields(
        input.userId,
        input.memoryItemId,
        {
          category: input.category,
          content: input.content,
          normalizedValue: input.normalizedValue,
        },
        db,
      );
      if (next) updated = next;
    }

    if (wantsStatusUpdate && input.status) {
      const next = await updateUserMemoryItemStatus(input.userId, input.memoryItemId, input.status, db);
      if (next) updated = next;
    }

    const auditAction = actionForManualChange(existing.status, wantsStatusUpdate ? (input.status ?? null) : null, wantsFieldUpdate);

    await insertMemoryAuditLogEntry(
      {
        memoryItemId: existing.id,
        userId: input.userId,
        action: auditAction,
        previousStatus: existing.status,
        newStatus: updated.status,
        reason: reason || "manual_change",
        actor: input.actor,
      },
      db,
    );

    const profile = wantsStatusUpdate || wantsFieldUpdate ? await compileUserProfileFromActiveMemory(input.userId, db) : undefined;

    return { item: updated, profile };
  });
}

type CandidateRecord = Record<string, unknown>;

function coerceCandidate(input: unknown, userId: string): CreateUserMemoryItemInput {
  const record = (input ?? {}) as CandidateRecord;

  const rawId = record.id;
  const id = typeof rawId === "string" && rawId.trim() ? rawId.trim() : crypto.randomUUID();

  const rawContent = record.content;
  const content = typeof rawContent === "string" ? rawContent.trim() : "";
  const sourceConversationId =
    typeof record.sourceConversationId === "string" ? record.sourceConversationId.trim() : "";

  if (!content) {
    throw new Error("Memory candidate missing content.");
  }
  if (!sourceConversationId) {
    throw new Error("Memory candidate missing sourceConversationId.");
  }
  if (typeof record.type !== "string" || !record.type.trim()) {
    throw new Error("Memory candidate missing type.");
  }

  return {
    id,
    userId,
    type: record.type as CreateUserMemoryItemInput["type"],
    category: typeof record.category === "string" ? record.category : "",
    content,
    normalizedValue: typeof record.normalizedValue === "string" ? record.normalizedValue : "",
    sourceConversationId,
    sourceMessageId:
      record.sourceMessageId === null || record.sourceMessageId === undefined
        ? null
        : Number(record.sourceMessageId),
    confidenceScore: record.confidenceScore === undefined ? 0 : Number(record.confidenceScore),
    relevanceScore: record.relevanceScore === undefined ? 0 : Number(record.relevanceScore),
    sensitivityLevel: record.sensitivityLevel as unknown as CreateUserMemoryItemInput["sensitivityLevel"],
    status: "candidate",
    validFrom: (record.validFrom as string | null | undefined) ?? null,
    validUntil: (record.validUntil as string | null | undefined) ?? null,
    createdBy:
      typeof record.createdBy === "string" && record.createdBy.trim() ? record.createdBy.trim() : "system",
  };
}

function auditActionForStatus(status: MemoryItemStatus): MemoryAuditAction {
  if (status === "active") return "promoted";
  if (status === "contradicted") return "contradicted";
  if (status === "archived") return "archived";
  if (status === "deleted") return "deleted";
  return "created";
}

export async function orchestrateMemoryCandidates(input: OrchestrateCandidatesInput): Promise<OrchestrateResult> {
  const actor = input.actor ?? "system";
  const reason = input.reason ?? "";
  const compileProfile = input.compileProfile ?? true;

  const candidates = input.candidates.map((candidate) => coerceCandidate(candidate, input.userId));

  // --- Governança de ingestão (Fase 12) ---
  const sourceMessageId = candidates.find((c) => c.sourceMessageId)?.sourceMessageId;
  const conversationId = candidates.find((c) => c.sourceConversationId)?.sourceConversationId || "unknown";

  if (sourceMessageId) {
    const existingLog = await getIngestionLogByMessageId(sourceMessageId);
    if (existingLog && (existingLog.status === "completed" || existingLog.status === "processing")) {
      console.info(`[MemoryOrchestrator] Message ${sourceMessageId} already processed or processing. Skipping.`);
      return {
        userId: input.userId,
        inserted: { active: 0, contradicted: 0, candidate: 0 },
        skippedDuplicates: candidates.length,
        updatedExisting: { contradicted: 0 },
        auditEntries: 0,
        profileCompiled: false,
        items: { inserted: [], updated: [] },
      };
    }
  }

  // Rate-limit persistente: máx 100 ingestões por dia por usuário
  const dailyLimit = 100;
  const recentCount = await countRecentIngestions(input.userId, 24);
  if (recentCount >= dailyLimit) {
    console.warn(`[MemoryOrchestrator] Rate limit reached for user ${input.userId} (${recentCount}/${dailyLimit}).`);
    if (sourceMessageId) {
      await insertIngestionLog({
        userId: input.userId,
        messageId: sourceMessageId,
        conversationId,
        status: "rate_limited",
        reason: `Daily limit of ${dailyLimit} ingestions reached.`,
      });
    }
    return {
      userId: input.userId,
      inserted: { active: 0, contradicted: 0, candidate: 0 },
      skippedDuplicates: candidates.length,
      updatedExisting: { contradicted: 0 },
      auditEntries: 0,
      profileCompiled: false,
      items: { inserted: [], updated: [] },
    };
  }

  // Registrar início do processamento
  if (sourceMessageId) {
    await insertIngestionLog({
      userId: input.userId,
      messageId: sourceMessageId,
      conversationId,
      status: "processing",
    });
  }
  // ----------------------------------------

  const decisions = await reconcileCandidates(candidates);

  const toInsert = decisions.filter((d) => d.kind !== "skip_duplicate") as Array<
    Extract<(typeof decisions)[number], { kind: "insert_active" | "insert_contradicted" }>
  >;
  const toUpdate = decisions
    .filter((d) => d.kind === "insert_active")
    .flatMap((d) => d.contradictExistingIds.map((id) => ({ id })));

  try {
    const result = await withMemoryTransaction(async (db) => {
      const insertedItems: UserMemoryItem[] = [];
      const updatedItems: UserMemoryItem[] = [];
      let auditCount = 0;

      for (const { id } of toUpdate) {
        const updated = await updateUserMemoryItemStatus(input.userId, id, "contradicted", db);
        if (updated) {
          updatedItems.push(updated);
          const audit: CreateMemoryAuditLogEntryInput = {
            memoryItemId: updated.id,
            userId: input.userId,
            action: "contradicted",
            previousStatus: "active",
            newStatus: "contradicted",
            reason: reason || "contradicted by higher-priority incoming item",
            actor,
          };
          await insertMemoryAuditLogEntry(audit, db);
          auditCount += 1;
        }
      }

      for (const decision of toInsert) {
        const item = await insertUserMemoryItem(decision.candidate, db);
        insertedItems.push(item);

        const audit: CreateMemoryAuditLogEntryInput = {
          memoryItemId: item.id,
          userId: input.userId,
          action: auditActionForStatus(item.status),
          previousStatus: null,
          newStatus: item.status,
          reason: reason || decision.reason,
          actor,
        };
        await insertMemoryAuditLogEntry(audit, db);
        auditCount += 1;
      }

      const shouldCompile =
        compileProfile && (insertedItems.some((i) => i.status === "active") || updatedItems.length > 0);

      const profile = shouldCompile ? await compileUserProfileFromActiveMemory(input.userId, db) : undefined;

      // --- Finalizar governança (Fase 12) ---
      if (sourceMessageId) {
        await insertIngestionLog(
          {
            userId: input.userId,
            messageId: sourceMessageId,
            conversationId,
            status: "completed",
          },
          db,
        );
      }
      // --------------------------------------

      return { insertedItems, updatedItems, auditCount, profile, profileCompiled: !!profile };
    });

    const inserted = {
      active: result.insertedItems.filter((i) => i.status === "active").length,
      contradicted: result.insertedItems.filter((i) => i.status === "contradicted").length,
      candidate: result.insertedItems.filter((i) => i.status === "candidate").length,
    };

    return {
      userId: input.userId,
      inserted,
      skippedDuplicates: decisions.filter((d) => d.kind === "skip_duplicate").length,
      updatedExisting: { contradicted: result.updatedItems.length },
      auditEntries: result.auditCount,
      profileCompiled: result.profileCompiled,
      profile: result.profile,
      items: { inserted: result.insertedItems, updated: result.updatedItems },
    };
  } catch (error) {
    if (sourceMessageId) {
      await insertIngestionLog({
        userId: input.userId,
        messageId: sourceMessageId,
        conversationId,
        status: "error",
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    throw error;
  }
}

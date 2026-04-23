import crypto from "node:crypto";

import { getDb, hasDatabase } from "../db";
import {
  MEMORY_AUDIT_ACTIONS,
  MEMORY_ITEM_STATUSES,
  MEMORY_ITEM_TYPES,
  MEMORY_SENSITIVITY_LEVELS,
} from "./constants";
import type {
  CreateIngestionLogInput,
  CreateMemoryAuditLogEntryInput,
  CreateUserMemoryItemInput,
  IngestionGovernanceEntry,
  IngestionStatus,
  MemoryAuditLogEntry,
  MemoryAuditAction,
  MemoryItemStatus,
  MemoryItemType,
  MemorySensitivityLevel,
  UpsertUserProfileInput,
  UserMemoryItem,
  UserProfile,
} from "./types";

type DbLike = {
  query: <TRow extends Record<string, unknown> = Record<string, unknown>>(
    text: string,
    params?: unknown[],
  ) => Promise<{ rows: TRow[] }>;
};

function assertDatabaseConfigured() {
  if (!hasDatabase()) {
    throw new Error("DATABASE_URL is not configured; memory orchestrator repository requires Postgres.");
  }
}

let schemaReady: Promise<void> | null = null;

async function ensureMemoryOrchestratorSchema(db?: DbLike) {
  assertDatabaseConfigured();
  const client = db ?? getDb();

  if (!schemaReady) {
    schemaReady = (async () => {
      try {
        const result = await client.query<{
          user_memory_items: string | null;
          user_profile: string | null;
          memory_audit_log: string | null;
          memory_ingestion_governance: string | null;
        }>(
          "select to_regclass('public.user_memory_items') as user_memory_items, to_regclass('public.user_profile') as user_profile, to_regclass('public.memory_audit_log') as memory_audit_log, to_regclass('public.memory_ingestion_governance') as memory_ingestion_governance",
        );
        const row = result.rows[0];
        const missing: string[] = [];
        if (!row?.user_memory_items) missing.push("public.user_memory_items");
        if (!row?.user_profile) missing.push("public.user_profile");
        if (!row?.memory_audit_log) missing.push("public.memory_audit_log");
        if (!row?.memory_ingestion_governance) missing.push("public.memory_ingestion_governance");

        if (missing.length > 0) {
          throw new Error(
            `Memory Orchestrator schema not found (missing: ${missing.join(
              ", ",
            )}). Apply migration app/lib/server/migrations/memory-orchestrator.migration.ts (e.g. run scripts/memory-orchestrator-migration.js).`,
          );
        }
      } catch (error) {
        schemaReady = null;
        throw error;
      }
    })();
  }

  await schemaReady;
}

function nowIso() {
  return new Date().toISOString();
}

type Row = Record<string, unknown>;

function readRowValue(row: Row, key: string): unknown {
  return row[key];
}

function readRowString(row: Row, key: string, fallback = "") {
  const value = readRowValue(row, key);
  return value === null || value === undefined ? fallback : String(value);
}

function readRowNumber(row: Row, key: string, fallback = 0) {
  const value = readRowValue(row, key);
  if (value === null || value === undefined) return fallback;
  return Number(value);
}

function readRowDateIso(row: Row, key: string): string | null {
  const value = readRowValue(row, key);
  if (!value) return null;
  return new Date(String(value)).toISOString();
}

function ensureEnumValue<T extends readonly string[]>(
  value: string | undefined,
  allowed: T,
  fallback: T[number],
): T[number] {
  if (!value) return fallback;
  return (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
}

function mapUserMemoryItemRow(row: Row): UserMemoryItem {
  return {
    id: readRowString(row, "id"),
    userId: readRowString(row, "user_id"),
    type: readRowString(row, "type") as MemoryItemType,
    category: readRowString(row, "category", ""),
    content: readRowString(row, "content", ""),
    normalizedValue: readRowString(row, "normalized_value", ""),
    sourceConversationId: readRowString(row, "source_conversation_id"),
    sourceMessageId: (() => {
      const value = readRowValue(row, "source_message_id");
      return value === null || value === undefined ? null : Number(value);
    })(),
    confidenceScore: readRowNumber(row, "confidence_score", 0),
    relevanceScore: readRowNumber(row, "relevance_score", 0),
    sensitivityLevel: readRowString(row, "sensitivity_level") as MemorySensitivityLevel,
    status: readRowString(row, "status") as MemoryItemStatus,
    validFrom: readRowDateIso(row, "valid_from"),
    validUntil: readRowDateIso(row, "valid_until"),
    createdBy: readRowString(row, "created_by", "system"),
    createdAt: readRowDateIso(row, "created_at") ?? nowIso(),
    updatedAt: readRowDateIso(row, "updated_at") ?? nowIso(),
  };
}

function mapUserProfileRow(row: Row): UserProfile {
  const interactionPreferences = readRowValue(row, "interaction_preferences");
  const recurringTopics = readRowValue(row, "recurring_topics");
  const activeGoals = readRowValue(row, "active_goals");
  const knownConstraints = readRowValue(row, "known_constraints");
  const keyFacts = readRowValue(row, "key_facts");

  return {
    userId: readRowString(row, "user_id"),
    summaryShort: readRowString(row, "summary_short", ""),
    summaryLong: readRowString(row, "summary_long", ""),
    interactionPreferences:
      interactionPreferences && typeof interactionPreferences === "object"
        ? (interactionPreferences as Record<string, unknown>)
        : {},
    recurringTopics: Array.isArray(recurringTopics) ? recurringTopics : [],
    activeGoals: Array.isArray(activeGoals) ? activeGoals : [],
    knownConstraints: Array.isArray(knownConstraints) ? knownConstraints : [],
    keyFacts: Array.isArray(keyFacts) ? keyFacts : [],
    profileVersion: readRowNumber(row, "profile_version", 1),
    lastCompiledAt: readRowDateIso(row, "last_compiled_at"),
    updatedAt: readRowDateIso(row, "updated_at") ?? nowIso(),
  };
}

function mapAuditLogRow(row: Row): MemoryAuditLogEntry {
  return {
    id: readRowNumber(row, "id", 0),
    memoryItemId: readRowString(row, "memory_item_id"),
    userId: readRowString(row, "user_id"),
    action: readRowString(row, "action") as MemoryAuditAction,
    previousStatus: (() => {
      const value = readRowValue(row, "previous_status");
      return value ? (String(value) as MemoryItemStatus) : null;
    })(),
    newStatus: (() => {
      const value = readRowValue(row, "new_status");
      return value ? (String(value) as MemoryItemStatus) : null;
    })(),
    reason: readRowString(row, "reason", ""),
    actor: readRowString(row, "actor", "system"),
    createdAt: readRowDateIso(row, "created_at") ?? nowIso(),
  };
}

export async function insertUserMemoryItem(input: CreateUserMemoryItemInput, db?: DbLike): Promise<UserMemoryItem> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const id = String(input.id || crypto.randomUUID());
  const type = ensureEnumValue(input.type, MEMORY_ITEM_TYPES, "declared_fact");
  const status = ensureEnumValue(input.status, MEMORY_ITEM_STATUSES, "candidate");
  const sensitivity = ensureEnumValue(input.sensitivityLevel, MEMORY_SENSITIVITY_LEVELS, "low");

  const result = await client.query(
    `
    insert into public.user_memory_items (
      id,
      user_id,
      type,
      category,
      content,
      normalized_value,
      source_conversation_id,
      source_message_id,
      confidence_score,
      relevance_score,
      sensitivity_level,
      status,
      valid_from,
      valid_until,
      created_by
    ) values (
      $1, $2, $3, $4, $5, $6, $7, $8,
      $9, $10, $11, $12, $13, $14, $15
    )
    returning *
    `,
    [
      id,
      input.userId,
      type,
      input.category ?? "",
      input.content,
      input.normalizedValue ?? "",
      input.sourceConversationId,
      input.sourceMessageId ?? null,
      input.confidenceScore ?? 0,
      input.relevanceScore ?? 0,
      sensitivity,
      status,
      input.validFrom ?? null,
      input.validUntil ?? null,
      input.createdBy ?? "system",
    ],
  );

  return mapUserMemoryItemRow(result.rows[0]);
}

export async function listUserMemoryItemsByUserId(
  userId: string,
  opts: { status?: MemoryItemStatus; limit?: number; type?: MemoryItemType } = {},
  db?: DbLike,
): Promise<UserMemoryItem[]> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const params: unknown[] = [userId];
  const where: string[] = ["user_id = $1"];

  if (opts.status) {
    params.push(opts.status);
    where.push(`status = $${params.length}`);
  }

  if (opts.type) {
    params.push(opts.type);
    where.push(`type = $${params.length}`);
  }

  const limit = Number.isFinite(opts.limit as number) ? Math.max(1, Math.min(1000, opts.limit as number)) : 100;
  params.push(limit);

  const result = await client.query(
    `
    select *
    from public.user_memory_items
    where ${where.join(" and ")}
    order by updated_at desc, created_at desc
    limit $${params.length}
    `,
    params,
  );

  return result.rows.map(mapUserMemoryItemRow);
}

export async function listUserMemoryItemsByStatus(
  userId: string,
  status: MemoryItemStatus,
  limit = 50,
  db?: DbLike,
): Promise<UserMemoryItem[]> {
  return listUserMemoryItemsByUserId(userId, { status, limit }, db);
}

export async function findActiveUserMemoryItemsByNormalizedValue(
  userId: string,
  normalizedValue: string,
  db?: DbLike,
): Promise<UserMemoryItem[]> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();
  const normalized = String(normalizedValue ?? "").trim();
  if (!normalized) return [];

  const result = await client.query(
    `
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and normalized_value = $2
    order by updated_at desc, created_at desc
    limit 25
    `,
    [userId, normalized],
  );

  return result.rows.map(mapUserMemoryItemRow);
}

export async function findActiveUserMemoryItemByDedupeKey(
  userId: string,
  type: MemoryItemType,
  normalizedValue: string,
  db?: DbLike,
): Promise<UserMemoryItem | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();
  const normalized = String(normalizedValue ?? "").trim();
  if (!normalized) return null;

  const result = await client.query(
    `
    select *
    from public.user_memory_items
    where user_id = $1
      and status = 'active'
      and type = $2
      and normalized_value = $3
    order by updated_at desc, created_at desc
    limit 1
    `,
    [userId, type, normalized],
  );

  return result.rows[0] ? mapUserMemoryItemRow(result.rows[0]) : null;
}

export async function getUserMemoryItemById(
  userId: string,
  memoryItemId: string,
  db?: DbLike,
): Promise<UserMemoryItem | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select *
    from public.user_memory_items
    where user_id = $1 and id = $2
    limit 1
    `,
    [userId, memoryItemId],
  );

  return result.rows[0] ? mapUserMemoryItemRow(result.rows[0] as Row) : null;
}

export async function updateUserMemoryItemStatus(
  userId: string,
  memoryItemId: string,
  status: MemoryItemStatus,
  db?: DbLike,
): Promise<UserMemoryItem | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();
  const nextStatus = ensureEnumValue(status, MEMORY_ITEM_STATUSES, "candidate");

  const result = await client.query(
    `
    update public.user_memory_items
    set status = $3,
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,
    [userId, memoryItemId, nextStatus],
  );

  return result.rows[0] ? mapUserMemoryItemRow(result.rows[0]) : null;
}

export type UpdateUserMemoryItemPatch = {
  category?: string;
  content?: string;
  normalizedValue?: string;
};

export async function updateUserMemoryItemFields(
  userId: string,
  memoryItemId: string,
  patch: UpdateUserMemoryItemPatch,
  db?: DbLike,
): Promise<UserMemoryItem | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const nextCategory = typeof patch.category === "string" ? patch.category : undefined;
  const nextContent = typeof patch.content === "string" ? patch.content : undefined;
  const nextNormalized = typeof patch.normalizedValue === "string" ? patch.normalizedValue : undefined;

  const result = await client.query(
    `
    update public.user_memory_items
    set category = coalesce($3, category),
        content = coalesce($4, content),
        normalized_value = coalesce($5, normalized_value),
        updated_at = now()
    where user_id = $1 and id = $2
    returning *
    `,
    [userId, memoryItemId, nextCategory ?? null, nextContent ?? null, nextNormalized ?? null],
  );

  return result.rows[0] ? mapUserMemoryItemRow(result.rows[0] as Row) : null;
}

export async function getUserProfile(userId: string, db?: DbLike): Promise<UserProfile | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select *
    from public.user_profile
    where user_id = $1
    limit 1
    `,
    [userId],
  );

  return result.rows[0] ? mapUserProfileRow(result.rows[0]) : null;
}

export async function upsertUserProfile(input: UpsertUserProfileInput, db?: DbLike): Promise<UserProfile> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const interactionPreferences = input.interactionPreferences ?? {};
  const recurringTopics = input.recurringTopics ?? [];
  const activeGoals = input.activeGoals ?? [];
  const knownConstraints = input.knownConstraints ?? [];
  const keyFacts = input.keyFacts ?? [];

  const result = await client.query(
    `
    insert into public.user_profile (
      user_id,
      summary_short,
      summary_long,
      interaction_preferences,
      recurring_topics,
      active_goals,
      known_constraints,
      key_facts,
      profile_version,
      last_compiled_at,
      updated_at
    ) values (
      $1, $2, $3,
      $4::jsonb, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb,
      $9, $10, now()
    )
    on conflict (user_id) do update set
      summary_short = excluded.summary_short,
      summary_long = excluded.summary_long,
      interaction_preferences = excluded.interaction_preferences,
      recurring_topics = excluded.recurring_topics,
      active_goals = excluded.active_goals,
      known_constraints = excluded.known_constraints,
      key_facts = excluded.key_facts,
      profile_version = excluded.profile_version,
      last_compiled_at = excluded.last_compiled_at,
      updated_at = now()
    returning *
    `,
    [
      input.userId,
      input.summaryShort ?? "",
      input.summaryLong ?? "",
      JSON.stringify(interactionPreferences),
      JSON.stringify(recurringTopics),
      JSON.stringify(activeGoals),
      JSON.stringify(knownConstraints),
      JSON.stringify(keyFacts),
      input.profileVersion ?? 1,
      input.lastCompiledAt ?? null,
    ],
  );

  return mapUserProfileRow(result.rows[0]);
}

/**
 * Lista todos os IDs de usuário que possuem algum item de memória ou perfil.
 */
export async function listUsersWithMemory(db?: DbLike): Promise<string[]> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();
  const res = await client.query<{ user_id: string }>(
    `
    select distinct user_id
    from (
      select user_id from public.user_memory_items
      union
      select user_id from public.user_profile
    ) sub
    order by user_id
    `,
  );
  return res.rows.map((r) => r.user_id);
}

export async function insertMemoryAuditLogEntry(
  input: CreateMemoryAuditLogEntryInput,
  db?: DbLike,
): Promise<MemoryAuditLogEntry> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const action = ensureEnumValue(input.action, MEMORY_AUDIT_ACTIONS, "created");
  const previousStatus = input.previousStatus ?? null;
  const newStatus = input.newStatus ?? null;

  const result = await client.query(
    `
    insert into public.memory_audit_log (
      memory_item_id,
      user_id,
      action,
      previous_status,
      new_status,
      reason,
      actor
    ) values (
      $1, $2, $3, $4, $5, $6, $7
    )
    returning *
    `,
    [
      input.memoryItemId,
      input.userId,
      action,
      previousStatus,
      newStatus,
      input.reason ?? "",
      input.actor ?? "system",
    ],
  );

  return mapAuditLogRow(result.rows[0]);
}

export type MemoryAuditEvent = MemoryAuditLogEntry & {
  itemType: MemoryItemType | null;
  itemStatus: MemoryItemStatus | null;
  itemContentPreview: string | null;
};

function mapAuditEventRow(row: Row): MemoryAuditEvent {
  const base = mapAuditLogRow(row);
  const previewRaw = readRowValue(row, "item_content_preview");
  const preview =
    previewRaw === null || previewRaw === undefined ? null : String(previewRaw).trim().slice(0, 140) || null;

  return {
    ...base,
    itemType: (() => {
      const value = readRowValue(row, "item_type");
      return value ? (String(value) as MemoryItemType) : null;
    })(),
    itemStatus: (() => {
      const value = readRowValue(row, "item_status");
      return value ? (String(value) as MemoryItemStatus) : null;
    })(),
    itemContentPreview: preview,
  };
}

export type MemoryAuditSummary = {
  userId: string;
  firstEventAt: string | null;
  automaticCaptures: number;
  manualCorrections: number;
  archived: number;
  contradicted: number;
  deleted: number;
};

export async function getMemoryAuditSummary(userId: string, db?: DbLike): Promise<MemoryAuditSummary> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select
      min(created_at) as first_event_at,
      count(*) filter (where reason = 'chat_stream_auto') as automatic_captures,
      count(*) filter (
        where reason like 'manual_%' or reason = 'manual_change'
      ) as manual_corrections,
      count(*) filter (where action = 'archived') as archived,
      count(*) filter (where action = 'contradicted') as contradicted,
      count(*) filter (where action = 'deleted') as deleted
    from public.memory_audit_log
    where user_id = $1
    `,
    [userId],
  );

  const row = (result.rows[0] ?? {}) as Row;
  return {
    userId,
    firstEventAt: readRowDateIso(row, "first_event_at"),
    automaticCaptures: readRowNumber(row, "automatic_captures", 0),
    manualCorrections: readRowNumber(row, "manual_corrections", 0),
    archived: readRowNumber(row, "archived", 0),
    contradicted: readRowNumber(row, "contradicted", 0),
    deleted: readRowNumber(row, "deleted", 0),
  };
}

export async function listMemoryAuditEvents(
  userId: string,
  opts: { limit?: number; memoryItemId?: string } = {},
  db?: DbLike,
): Promise<MemoryAuditEvent[]> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const limit = Number.isFinite(opts.limit as number) ? Math.max(1, Math.min(500, opts.limit as number)) : 100;
  const memoryItemId = typeof opts.memoryItemId === "string" && opts.memoryItemId.trim() ? opts.memoryItemId.trim() : null;

  const result = await client.query(
    `
    select
      al.*,
      umi.type as item_type,
      umi.status as item_status,
      left(umi.content, 140) as item_content_preview
    from public.memory_audit_log al
    left join public.user_memory_items umi
      on umi.id = al.memory_item_id and umi.user_id = al.user_id
    where al.user_id = $1
      and ($2::text is null or al.memory_item_id = $2::text)
    order by al.created_at desc
    limit $3
    `,
    [userId, memoryItemId, limit],
  );

  return (result.rows as Row[]).map(mapAuditEventRow);
}

export async function getIngestionLogByMessageId(
  messageId: number,
  db?: DbLike,
): Promise<IngestionGovernanceEntry | null> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select *
    from public.memory_ingestion_governance
    where message_id = $1
    limit 1
    `,
    [messageId],
  );

  return result.rows[0] ? mapIngestionLogRow(result.rows[0]) : null;
}

export async function insertIngestionLog(
  input: CreateIngestionLogInput,
  db?: DbLike,
): Promise<IngestionGovernanceEntry> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    insert into public.memory_ingestion_governance (
      user_id,
      message_id,
      conversation_id,
      status,
      reason
    ) values (
      $1, $2, $3, $4, $5
    )
    on conflict (message_id) where message_id is not null
    do update set
      status = excluded.status,
      reason = excluded.reason,
      updated_at = now()
    returning *
    `,
    [input.userId, input.messageId ?? null, input.conversationId, input.status, input.reason ?? null],
  );

  return mapIngestionLogRow(result.rows[0]);
}

export async function countRecentIngestions(userId: string, hours: number, db?: DbLike): Promise<number> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select count(*) as count
    from public.memory_ingestion_governance
    where user_id = $1
      and status in ('completed', 'processing')
      and created_at >= now() - interval '1 hour' * $2
    `,
    [userId, hours],
  );

  return readRowNumber(result.rows[0] as Row, "count", 0);
}

export async function listIngestionLogs(
  userId: string,
  limit = 50,
  db?: DbLike,
): Promise<IngestionGovernanceEntry[]> {
  await ensureMemoryOrchestratorSchema(db);
  const client = db ?? getDb();

  const result = await client.query(
    `
    select *
    from public.memory_ingestion_governance
    where user_id = $1
    order by created_at desc
    limit $2
    `,
    [userId, limit],
  );

  return (result.rows as Row[]).map(mapIngestionLogRow);
}

function mapIngestionLogRow(row: Row): IngestionGovernanceEntry {
  return {
    id: readRowNumber(row, "id", 0),
    userId: readRowString(row, "user_id"),
    messageId: (() => {
      const value = readRowValue(row, "message_id");
      return value === null || value === undefined ? null : Number(value);
    })(),
    conversationId: readRowString(row, "conversation_id"),
    status: readRowString(row, "status") as IngestionStatus,
    reason: readRowValue(row, "reason") ? String(readRowValue(row, "reason")) : null,
    createdAt: readRowDateIso(row, "created_at") ?? nowIso(),
    updatedAt: readRowDateIso(row, "updated_at") ?? nowIso(),
  };
}

export async function withMemoryTransaction<T>(fn: (db: DbLike) => Promise<T>): Promise<T> {
  await ensureMemoryOrchestratorSchema();
  const pool = getDb();
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client as unknown as DbLike);
    await client.query("COMMIT");
    return result;
  } catch (error) {
    await client.query("ROLLBACK").catch(() => null);
    throw error;
  } finally {
    client.release();
  }
}

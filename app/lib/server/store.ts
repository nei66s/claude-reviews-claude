import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { SessionUser } from "./auth";
import { findDbUserByEmail, getDb, hasDatabase } from "./db";

// Cache para conversas com TTL
type CacheEntry<T> = {
  data: T;
  timestamp: number;
};

const conversationsCache = new Map<string, CacheEntry<StoredConversation[]>>();
const CACHE_TTL = 1000 * 60; // 60 segundos

function getCachedConversations(userId: string): StoredConversation[] | null {
  const cached = conversationsCache.get(userId);
  if (!cached) return null;

  const age = Date.now() - cached.timestamp;
  if (age > CACHE_TTL) {
    conversationsCache.delete(userId);
    return null;
  }

  return cached.data;
}

function setCachedConversations(userId: string, data: StoredConversation[]): void {
  conversationsCache.set(userId, {
    data,
    timestamp: Date.now(),
  });
}

function invalidateConversationsCache(userId: string): void {
  conversationsCache.delete(userId);
}

export type ChatMessage = {
  id?: number; // ID numérico único da mensagem
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
  feedback?: "like" | "dislike" | null; // Feedback do usuário para esta mensagem
  feedbackText?: string; // Texto do feedback se houver
  // Identidade do agente que respondeu (para persistir avatar/nome após reload).
  agentId?: string;
  helperAgentId?: string;
  handoffLabel?: string;
  collaborationLabel?: string;
  trace?: unknown[];
};

export type StoredConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

type MessagesSchema = {
  agentId: boolean;
  helperAgentId: boolean;
  handoffLabel: boolean;
  collaborationLabel: boolean;
  traceJson: boolean;
};

let ensuredMessagesSchema: Promise<void> | null = null;
let messagesSchemaAlterDenied = false;
let cachedMessagesSchema:
  | {
      value: MessagesSchema;
      timestamp: number;
    }
  | null = null;
const MESSAGES_SCHEMA_TTL = 1000 * 30; // 30s

function isAlterDeniedError(error: unknown) {
  if (!(error instanceof Error)) return false;
  return (
    /must be owner of relation/i.test(error.message) ||
    /must be owner of table/i.test(error.message) ||
    /permission denied/i.test(error.message)
  );
}

async function detectMessagesSchema(db: ReturnType<typeof getDb>): Promise<MessagesSchema> {
  const now = Date.now();
  if (cachedMessagesSchema && now - cachedMessagesSchema.timestamp < MESSAGES_SCHEMA_TTL) {
    return cachedMessagesSchema.value;
  }

  const targetColumns = [
    "agent_id",
    "helper_agent_id",
    "handoff_label",
    "collaboration_label",
    "trace_json",
  ];

  const result = await db.query<{ column_name: string }>(
    `select column_name
     from information_schema.columns
     where table_schema = 'public'
       and table_name = 'messages'
       and column_name = any($1::text[])`,
    [targetColumns],
  );

  const present = new Set(result.rows.map((row) => row.column_name));
  const value: MessagesSchema = {
    agentId: present.has("agent_id"),
    helperAgentId: present.has("helper_agent_id"),
    handoffLabel: present.has("handoff_label"),
    collaborationLabel: present.has("collaboration_label"),
    traceJson: present.has("trace_json"),
  };

  cachedMessagesSchema = { value, timestamp: now };
  return value;
}

async function tryEnsureMessagesSchemaReady() {
  if (!hasDatabase()) return;
  if (messagesSchemaAlterDenied) return;
  if (ensuredMessagesSchema) return ensuredMessagesSchema;

  const db = getDb();
  ensuredMessagesSchema = db
    .query(`
      ALTER TABLE public.messages
        ADD COLUMN IF NOT EXISTS agent_id TEXT,
        ADD COLUMN IF NOT EXISTS helper_agent_id TEXT,
        ADD COLUMN IF NOT EXISTS handoff_label TEXT,
        ADD COLUMN IF NOT EXISTS collaboration_label TEXT;
    `)
    .then(() => {
      cachedMessagesSchema = null;
      return undefined;
    })
    .catch((err) => {
      ensuredMessagesSchema = null;
      if (isAlterDeniedError(err)) {
        messagesSchemaAlterDenied = true;
        return;
      }
      throw err;
    });

  return ensuredMessagesSchema;
}

type AuditLog = {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error";
  message: string;
  data?: unknown;
};

type PluginCapability = {
  type: string;
  name: string;
  description: string;
};

type PluginRecord = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  status: "active" | "development" | "beta" | "experimental";
  capabilities: PluginCapability[];
};

type ToolRecord = {
  name: string;
  enabled: boolean;
  category: string;
  reason?: string;
};

export type WorkflowStepStatus = "pending" | "in_progress" | "completed";

export type WorkflowStep = {
  id: string;
  text: string;
  status: WorkflowStepStatus;
};

export type StoredWorkflow = {
  chatId: string;
  goal: string;
  summary?: string;
  createdAt: string;
  updatedAt: string;
  steps: WorkflowStep[];
};

type UserState = {
  conversations: StoredConversation[];
  workflows: StoredWorkflow[];
  logs: AuditLog[];
  plugins: PluginRecord[];
  tools: ToolRecord[];
};

type AppSettings = {
  fullAccess: boolean;
  permissionMode: "ask" | "auto" | "read_only";
  memoryMode: "off" | "explicit" | "smart";
  approvedTools: string[];
  sandboxEnabled: boolean;
  sandboxWritableRoots: string[];
};

const CONFIGURED_DATA_DIR = process.env.CHOCKS_DATA_DIR?.trim();
const DEFAULT_LOCAL_DATA_DIR = path.join(process.cwd(), ".chocks-local");
const DEFAULT_SERVERLESS_DATA_DIR = path.join(os.tmpdir(), "chocks-local");

function resolveDataDir() {
  if (CONFIGURED_DATA_DIR) {
    return CONFIGURED_DATA_DIR;
  }

  if (process.env.VERCEL === "1" || process.env.AWS_LAMBDA_FUNCTION_NAME) {
    return DEFAULT_SERVERLESS_DATA_DIR;
  }

  return DEFAULT_LOCAL_DATA_DIR;
}

let cachedDataDir: string | null = null;

function getDataDir() {
  if (!cachedDataDir) {
    cachedDataDir = resolveDataDir();
  }

  return cachedDataDir;
}

const defaultPlugins = (): PluginRecord[] => [
  {
    id: "openai",
    name: "OpenAI Integration",
    description: "Integração com APIs OpenAI para processamento avançado de linguagem natural.",
    enabled: true,
    status: "active",
    capabilities: [
      {
        type: "network",
        name: "GPT Models",
        description: "Acesso aos modelos GPT-4, GPT-3.5 Turbo e variantes.",
      },
      {
        type: "api",
        name: "Embeddings",
        description: "Geração de embeddings para busca semântica.",
      },
      {
        type: "skill",
        name: "Moderation",
        description: "Moderation API para conteúdo apropriado.",
      },
    ],
  },
  {
    id: "github",
    name: "GitHub Integration",
    description: "Controle total de repositorios, PRs, issues e workflows.",
    enabled: true,
    status: "development",
    capabilities: [
      {
        type: "vcs",
        name: "Repository Ops",
        description: "Clone, push, pull, e gerenciamento de branches.",
      },
      {
        type: "api",
        name: "GitHub API",
        description: "Acesso à API REST e GraphQL do GitHub.",
      },
      {
        type: "autom",
        name: "Workflows",
        description: "Controle de GitHub Actions e CI/CD.",
      },
    ],
  },
  {
    id: "obsidian-sync",
    name: "Obsidian Sync",
    description: "Sincronização bidirecional com vault do Obsidian.",
    enabled: true,
    status: "beta",
    capabilities: [
      {
        type: "storage",
        name: "Vault Sync",
        description: "Sincroniza notas entre Obsidian e o sistema.",
      },
      {
        type: "search",
        name: "Full-Text Search",
        description: "Busca avançada em todas as notas.",
      },
      {
        type: "skill",
        name: "Knowledge Graph",
        description: "Visualiza relações entre notas e tags.",
      },
    ],
  },
  {
    id: "database-tools",
    name: "Database Tools",
    description: "Suporte para PostgreSQL, MongoDB, SQLite e Redis.",
    enabled: true,
    status: "development",
    capabilities: [
      {
        type: "database",
        name: "Query Builder",
        description: "Interface amigável para queries SQL e NoSQL.",
      },
      {
        type: "autom",
        name: "Migrations",
        description: "Versionamento e controle de schema.",
      },
      {
        type: "monitoring",
        name: "Metrics",
        description: "Performance e health checks em tempo real.",
      },
    ],
  },
  {
    id: "docker-integration",
    name: "Docker & Containers",
    description: "Gerenciamento completo de containers e orquestração.",
    enabled: false,
    status: "experimental",
    capabilities: [
      {
        type: "deployment",
        name: "Container Ops",
        description: "Build, deploy e manage Docker containers.",
      },
      {
        type: "monitoring",
        name: "Docker Compose",
        description: "Orquestração multi-container.",
      },
      {
        type: "skill",
        name: "Kubernetes",
        description: "Suporte a K8s clusters e manifests.",
      },
    ],
  },
  {
    id: "analytics",
    name: "Analytics & Monitoring",
    description: "Rastreamento de métricas, logs e performance.",
    enabled: true,
    status: "development",
    capabilities: [
      {
        type: "monitoring",
        name: "Real-time Metrics",
        description: "Dashboard de performance e estatísticas.",
      },
      {
        type: "logging",
        name: "Log Aggregation",
        description: "Centralização de logs com busca avançada.",
      },
      {
        type: "notification",
        name: "Alerting",
        description: "Alertas automáticos para anomalias.",
      },
    ],
  },
  {
    id: "slack-notifications",
    name: "Slack Integration",
    description: "Notificações e integração bidirecional com Slack.",
    enabled: false,
    status: "experimental",
    capabilities: [
      {
        type: "notification",
        name: "Bot Commands",
        description: "Bot responde comandos no Slack.",
      },
      {
        type: "autom",
        name: "Smart Notifications",
        description: "Alertas contextualizados em canais.",
      },
      {
        type: "integration",
        name: "Slash Commands",
        description: "Comandos customizados com /chocks.",
      },
    ],
  },
  {
    id: "vercel",
    name: "Vercel Deployment",
    description: "Integração local simulada para restaurar a interface.",
    enabled: true,
    status: "beta",
    capabilities: [
      {
        type: "deployment",
        name: "Deployments",
        description: "Deploy automático e preview URLs.",
      },
      {
        type: "monitoring",
        name: "Toolbar",
        description: "Exibe recursos de integração disponíveis.",
      },
      {
        type: "analytics",
        name: "Edge Analytics",
        description: "Analytics globais distribuído.",
      },
    ],
  },
];

const defaultTools = (): ToolRecord[] => [
  { name: "file_read", enabled: true, category: "filesystem" },
  { name: "file_write", enabled: false, category: "filesystem", reason: "Modo seguro local" },
  { name: "memory_search", enabled: true, category: "memory" },
  { name: "memory_read", enabled: true, category: "memory" },
  { name: "memory_capture", enabled: false, category: "memory", reason: "Modo seguro local" },
  { name: "memory_upsert", enabled: false, category: "memory", reason: "Modo seguro local" },
  { name: "memory_append", enabled: false, category: "memory", reason: "Modo seguro local" },
  { name: "grep", enabled: true, category: "search" },
  { name: "web_fetch", enabled: true, category: "network" },
];

function defaultState(): UserState {
  return {
    conversations: [],
    workflows: [],
    logs: [],
    plugins: defaultPlugins(),
    tools: defaultTools(),
  };
}

function defaultAppSettings(): AppSettings {
  return {
    fullAccess: false,
    permissionMode: "ask",
    memoryMode: "explicit",
    approvedTools: [],
    sandboxEnabled: true,
    sandboxWritableRoots: [],
  };
}

async function ensureDataDir() {
  const preferredDir = getDataDir();

  try {
    await fs.mkdir(preferredDir, { recursive: true });
    cachedDataDir = preferredDir;
    return preferredDir;
  } catch (error) {
    if (preferredDir === DEFAULT_SERVERLESS_DATA_DIR || CONFIGURED_DATA_DIR) {
      throw error;
    }

    await fs.mkdir(DEFAULT_SERVERLESS_DATA_DIR, { recursive: true });
    cachedDataDir = DEFAULT_SERVERLESS_DATA_DIR;
    return DEFAULT_SERVERLESS_DATA_DIR;
  }
}

async function resolveOwnerId(user: SessionUser) {
  if (!hasDatabase()) {
    return user.id;
  }

  if (user.id !== "local-admin") {
    return user.id;
  }

  const dbUser = await findDbUserByEmail(user.email).catch(() => null);
  return dbUser?.id ?? user.id;
}

function getStatePath(userId: string) {
  return path.join(getDataDir(), `${userId}.json`);
}

export async function readState(userId: string) {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(getStatePath(userId), "utf8");
    const parsed = JSON.parse(raw) as Partial<UserState>;
    return {
      conversations: Array.isArray(parsed.conversations) ? parsed.conversations : [],
      workflows: Array.isArray(parsed.workflows) ? parsed.workflows : [],
      logs: Array.isArray(parsed.logs) ? parsed.logs : [],
      plugins: Array.isArray(parsed.plugins) ? parsed.plugins : defaultPlugins(),
      tools: Array.isArray(parsed.tools) ? parsed.tools : defaultTools(),
    } satisfies UserState;
  } catch {
    return defaultState();
  }
}

export async function writeState(userId: string, state: UserState) {
  await ensureDataDir();
  await fs.writeFile(getStatePath(userId), JSON.stringify(state, null, 2), "utf8");
}

export async function readAppSettings() {
  const dataDir = await ensureDataDir();
  try {
    const raw = await fs.readFile(path.join(dataDir, "app-settings.json"), "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      fullAccess: Boolean(parsed.fullAccess),
      permissionMode:
        parsed.permissionMode === "auto" || parsed.permissionMode === "read_only"
          ? parsed.permissionMode
          : "ask",
      memoryMode:
        parsed.memoryMode === "off" || parsed.memoryMode === "explicit" || parsed.memoryMode === "smart"
          ? parsed.memoryMode
          : "explicit",
      approvedTools: Array.isArray(parsed.approvedTools)
        ? parsed.approvedTools.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
      sandboxEnabled: parsed.sandboxEnabled !== false,
      sandboxWritableRoots: Array.isArray(parsed.sandboxWritableRoots)
        ? parsed.sandboxWritableRoots.map((item) => String(item || "").trim()).filter(Boolean)
        : [],
    } satisfies AppSettings;
  } catch {
    return defaultAppSettings();
  }
}

export async function writeAppSettings(settings: AppSettings) {
  const dataDir = await ensureDataDir();
  await fs.writeFile(
    path.join(dataDir, "app-settings.json"),
    JSON.stringify(settings, null, 2),
    "utf8",
  );
}

export async function appendLog(
  user: SessionUser,
  level: AuditLog["level"],
  message: string,
  data?: unknown,
) {
  const state = await readState(user.id);
  state.logs.unshift({
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    level,
    message,
    data,
  });
  state.logs = state.logs.slice(0, 100);
  await writeState(user.id, state);
}

export async function listConversations(user: SessionUser) {
  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);
    await tryEnsureMessagesSchemaReady();
    const messagesSchema = await detectMessagesSchema(db);

    // Verificar cache primeiro
    const cached = getCachedConversations(ownerId);
    if (cached) {
      return cached;
    }

    const conversationResult = await db.query<
      Pick<StoredConversation, "id" | "title">
    >(
      `select id, title
       from public.conversations
       where owner_id = $1
       order by updated_at desc, created_at desc`,
      [ownerId],
    );

    const ids = conversationResult.rows.map(
      (row: Pick<StoredConversation, "id" | "title">) => row.id,
    );
    if (ids.length === 0) {
      setCachedConversations(ownerId, []);
      return [];
    }

    type DbMessageRow = {
      id: string;
      conversation_id: string;
      sort_order: number;
      role: "user" | "agent";
      content: string;
      streaming: boolean;
      user_feedback: string | null;
      user_feedback_text: string | null;
      agent_id: string | null;
      helper_agent_id: string | null;
      handoff_label: string | null;
      collaboration_label: string | null;
      trace_json: unknown[] | null;
    };

    const messageResult = await db.query<DbMessageRow>(
      `select 
        COALESCE(m.id::text, '') as id,
        m.conversation_id, 
        m.sort_order, 
        m.role, 
        m.content, 
        m.streaming,
        ${messagesSchema.agentId ? "m.agent_id" : "NULL::text"} as agent_id,
        ${messagesSchema.helperAgentId ? "m.helper_agent_id" : "NULL::text"} as helper_agent_id,
        ${messagesSchema.handoffLabel ? "m.handoff_label" : "NULL::text"} as handoff_label,
        ${messagesSchema.collaborationLabel ? "m.collaboration_label" : "NULL::text"} as collaboration_label,
        ${messagesSchema.traceJson ? "m.trace_json" : "NULL::jsonb"} as trace_json,
        mf.feedback as user_feedback,
        mf.feedback_text as user_feedback_text
       from public.messages m
       left join public.message_feedback mf on 
         (m.id = mf.message_number OR m.id::text = mf.message_id) 
         and mf.user_id = $2
       where m.conversation_id = any($1::text[])
       order by m.conversation_id asc, m.sort_order asc, m.id asc`,
      [ids, ownerId],
    );

    const messagesByConversation = new Map<string, ChatMessage[]>();
    for (const row of messageResult.rows) {
      const list = messagesByConversation.get(row.conversation_id) ?? [];
      const msgId = row.id ? parseInt(row.id, 10) : undefined;
      const normalizedTrace = (() => {
        if (Array.isArray(row.trace_json)) return row.trace_json;
        if (typeof row.trace_json === "string") {
          try {
            const parsed = JSON.parse(row.trace_json) as unknown;
            return Array.isArray(parsed) ? (parsed as unknown[]) : undefined;
          } catch {
            return undefined;
          }
        }
        return undefined;
      })();
      const message: ChatMessage = {
        id: msgId,
        role: row.role,
        content: row.content,
        streaming: row.streaming,
        agentId: row.agent_id || undefined,
        helperAgentId: row.helper_agent_id || undefined,
        handoffLabel: row.handoff_label || undefined,
        collaborationLabel: row.collaboration_label || undefined,
        trace: normalizedTrace,
      };
      
      // Incluir feedback se existir
      if (row.user_feedback) {
        message.feedback = row.user_feedback as "like" | "dislike" | null;
        message.feedbackText = row.user_feedback_text || undefined;
        console.log(`[Store] Message ${msgId} has feedback: ${row.user_feedback}`);
      }
      
      list.push(message);
      messagesByConversation.set(row.conversation_id, list);
    }

    console.log(`[Store] Loaded ${messageResult.rows.length} messages with feedback mapping`);

    const result = conversationResult.rows.map(
      (conversation: Pick<StoredConversation, "id" | "title">) => ({
        id: conversation.id,
        title: conversation.title,
        messages: messagesByConversation.get(conversation.id) ?? [],
      }),
    );

    // Armazenar em cache
    setCachedConversations(ownerId, result);
    return result;
  }

  const state = await readState(user.id);
  return state.conversations;
}

export async function createConversation(
  user: SessionUser,
  input: { id: string; title?: string },
) {
  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);
    const title = input.title?.trim() || "Nova conversa";
    await db.query(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)
       on conflict (id)
       do update set title = excluded.title, owner_id = excluded.owner_id, updated_at = now()`,
      [input.id, title, ownerId],
    );
    invalidateConversationsCache(ownerId);
    await appendLog(user, "info", "Conversa criada", { id: input.id });
    return {
      id: input.id,
      title,
      messages: [],
    } satisfies StoredConversation;
  }

  const state = await readState(user.id);
  const conversation: StoredConversation = {
    id: input.id,
    title: input.title?.trim() || "Nova conversa",
    messages: [],
  };
  state.conversations = [
    conversation,
    ...state.conversations.filter((item) => item.id !== conversation.id),
  ];
  await writeState(user.id, state);
  await appendLog(user, "info", "Conversa criada", { id: conversation.id });
  return conversation;
}

export async function upsertConversation(user: SessionUser, conversation: StoredConversation) {
  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);
    await tryEnsureMessagesSchemaReady();
    const messagesSchema = await detectMessagesSchema(db);

    await db.query(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)
       on conflict (id)
       do update set title = excluded.title, owner_id = excluded.owner_id, updated_at = now()`,
      [conversation.id, conversation.title, ownerId],
    );

    await db.query("delete from public.messages where conversation_id = $1", [
      conversation.id,
    ]);

    for (const [index, message] of conversation.messages.entries()) {
      const columns = ["conversation_id", "sort_order", "role", "content", "streaming"];
      const values: Array<string> = ["$1", "$2", "$3", "$4", "$5"];
      const params: unknown[] = [
        conversation.id,
        index,
        message.role,
        message.content,
        Boolean(message.streaming),
      ];

      if (messagesSchema.agentId) {
        columns.push("agent_id");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.agentId || null : null);
      }

      if (messagesSchema.helperAgentId) {
        columns.push("helper_agent_id");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.helperAgentId || null : null);
      }

      if (messagesSchema.handoffLabel) {
        columns.push("handoff_label");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.handoffLabel || null : null);
      }

      if (messagesSchema.collaborationLabel) {
        columns.push("collaboration_label");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.collaborationLabel || null : null);
      }

      if (messagesSchema.traceJson) {
        columns.push("trace_json");
        values.push(`$${params.length + 1}`);
        params.push(
          message.role === "agent" && Array.isArray(message.trace)
            ? JSON.stringify(message.trace)
            : null,
        );
      }

      await db.query(
        `insert into public.messages (${columns.join(", ")})
         values (${values.join(", ")})`,
        params,
      );
    }

    invalidateConversationsCache(ownerId);
    return;
  }

  const state = await readState(user.id);
  state.conversations = [
    conversation,
    ...state.conversations.filter((item) => item.id !== conversation.id),
  ];
  await writeState(user.id, state);
}

export async function deleteConversation(user: SessionUser, conversationId: string) {
  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);

    await db.query(
      `delete from public.conversations
       where id = $1 and owner_id = $2`,
      [conversationId, ownerId],
    );

    invalidateConversationsCache(ownerId);
    await appendLog(user, "info", "Conversa removida", { id: conversationId });
    return;
  }

  const state = await readState(user.id);
  state.conversations = state.conversations.filter((item) => item.id !== conversationId);
  state.workflows = state.workflows.filter((item) => item.chatId !== conversationId);
  await writeState(user.id, state);
  await appendLog(user, "info", "Conversa removida", { id: conversationId });
}

export async function renameConversation(
  user: SessionUser,
  conversationId: string,
  title: string,
) {
  const trimmedTitle = title.trim() || "Nova conversa";

  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);
    await db.query(
      `update public.conversations
       set title = $2, updated_at = now()
       where id = $1 and owner_id = $3`,
      [conversationId, trimmedTitle, ownerId],
    );
    invalidateConversationsCache(ownerId);
    await appendLog(user, "info", "Conversa renomeada", { id: conversationId, title: trimmedTitle });
    return { id: conversationId, title: trimmedTitle };
  }

  const state = await readState(user.id);
  state.conversations = state.conversations.map((item) =>
    item.id === conversationId ? { ...item, title: trimmedTitle } : item,
  );
  await writeState(user.id, state);
  await appendLog(user, "info", "Conversa renomeada", { id: conversationId, title: trimmedTitle });
  return state.conversations.find((item) => item.id === conversationId) ?? null;
}

export async function duplicateConversation(
  user: SessionUser,
  sourceId: string,
  nextId: string,
) {
  if (hasDatabase()) {
    const db = getDb();
    const ownerId = await resolveOwnerId(user);
    await tryEnsureMessagesSchemaReady();
    const messagesSchema = await detectMessagesSchema(db);
    const conversationResult = await db.query<
      { id: string; title: string }
    >(
      `select id, title
       from public.conversations
       where id = $1 and owner_id = $2
       limit 1`,
      [sourceId, ownerId],
    );
    const sourceConversation = conversationResult.rows[0];
    if (!sourceConversation) {
      throw new Error("conversation not found");
    }

    const copyTitle = `${sourceConversation.title || "Nova conversa"} (copia)`;
    await db.query(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)`,
      [nextId, copyTitle, ownerId],
    );

    const messages = await db.query<
      ChatMessage & {
        sort_order: number;
        agent_id: string | null;
        helper_agent_id: string | null;
        handoff_label: string | null;
        collaboration_label: string | null;
        trace_json: unknown[] | null;
      }
    >(
      `select
        sort_order,
        role,
        content,
        streaming,
        ${messagesSchema.agentId ? "agent_id" : "NULL::text"} as agent_id,
        ${messagesSchema.helperAgentId ? "helper_agent_id" : "NULL::text"} as helper_agent_id,
        ${messagesSchema.handoffLabel ? "handoff_label" : "NULL::text"} as handoff_label,
        ${messagesSchema.collaborationLabel ? "collaboration_label" : "NULL::text"} as collaboration_label,
        ${messagesSchema.traceJson ? "trace_json" : "NULL::jsonb"} as trace_json
       from public.messages
       where conversation_id = $1
       order by sort_order asc, id asc`,
      [sourceId],
    );

    for (const message of messages.rows) {
      const columns = ["conversation_id", "sort_order", "role", "content", "streaming"];
      const values: Array<string> = ["$1", "$2", "$3", "$4", "$5"];
      const params: unknown[] = [
        nextId,
        message.sort_order,
        message.role,
        message.content,
        Boolean(message.streaming),
      ];

      if (messagesSchema.agentId) {
        columns.push("agent_id");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.agent_id : null);
      }

      if (messagesSchema.helperAgentId) {
        columns.push("helper_agent_id");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.helper_agent_id : null);
      }

      if (messagesSchema.handoffLabel) {
        columns.push("handoff_label");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.handoff_label : null);
      }

      if (messagesSchema.collaborationLabel) {
        columns.push("collaboration_label");
        values.push(`$${params.length + 1}`);
        params.push(message.role === "agent" ? message.collaboration_label : null);
      }

      if (messagesSchema.traceJson) {
        columns.push("trace_json");
        values.push(`$${params.length + 1}`);
        params.push(
          message.role === "agent" && message.trace_json != null
            ? JSON.stringify(message.trace_json)
            : null,
        );
      }

      await db.query(
        `insert into public.messages (${columns.join(", ")})
         values (${values.join(", ")})`,
        params,
      );
    }

    await appendLog(user, "info", "Conversa duplicada", { sourceId, nextId });
    return {
      id: nextId,
      title: copyTitle,
      messages: messages.rows.map((message) => ({
        role: message.role,
        content: message.content,
        streaming: Boolean(message.streaming),
      })),
    };
  }

  const state = await readState(user.id);
  const sourceConversation = state.conversations.find((item) => item.id === sourceId);
  if (!sourceConversation) {
    throw new Error("conversation not found");
  }

  const copy = {
    ...sourceConversation,
    id: nextId,
    title: `${sourceConversation.title || "Nova conversa"} (copia)`,
    messages: sourceConversation.messages.map((message) => ({ ...message })),
  };
  state.conversations = [copy, ...state.conversations];

  const sourceWorkflow = state.workflows.find((item) => item.chatId === sourceId);
  if (sourceWorkflow) {
    state.workflows = [
      {
        ...sourceWorkflow,
        chatId: nextId,
        updatedAt: new Date().toISOString(),
      },
      ...state.workflows,
    ];
  }

  await writeState(user.id, state);
  await appendLog(user, "info", "Conversa duplicada", { sourceId, nextId });
  return copy;
}

export async function getWorkflowState(user: SessionUser, chatId: string) {
  const normalizedChatId = chatId.trim();
  if (!normalizedChatId) return null;

  const state = await readState(user.id);
  return state.workflows.find((item) => item.chatId === normalizedChatId) ?? null;
}

export async function saveWorkflowState(user: SessionUser, workflow: StoredWorkflow) {
  const state = await readState(user.id);
  state.workflows = [
    workflow,
    ...state.workflows.filter((item) => item.chatId !== workflow.chatId),
  ];
  await writeState(user.id, state);
  await appendLog(user, "info", "Workflow atualizado", {
    chatId: workflow.chatId,
    goal: workflow.goal,
    steps: workflow.steps.length,
  });
  return workflow;
}

export async function clearWorkflowState(user: SessionUser, chatId: string) {
  const normalizedChatId = chatId.trim();
  const state = await readState(user.id);
  state.workflows = state.workflows.filter((item) => item.chatId !== normalizedChatId);
  await writeState(user.id, state);
  await appendLog(user, "info", "Workflow limpo", { chatId: normalizedChatId });
  return { cleared: true };
}

export async function listLogs(user: SessionUser) {
  const state = await readState(user.id);
  return state.logs;
}

export async function listPlugins(user: SessionUser) {
  const state = await readState(user.id);
  return state.plugins;
}

export async function togglePlugin(user: SessionUser, id: string, enabled: boolean) {
  const state = await readState(user.id);
  state.plugins = state.plugins.map((plugin) =>
    plugin.id === id ? { ...plugin, enabled } : plugin,
  );
  await writeState(user.id, state);
  await appendLog(user, "info", "Plugin atualizado", { id, enabled });
  return state.plugins.find((plugin) => plugin.id === id) ?? null;
}

export async function listTools(user: SessionUser) {
  const state = await readState(user.id);
  return state.tools;
}

export async function toggleTool(user: SessionUser, name: string, enabled: boolean) {
  const state = await readState(user.id);
  state.tools = state.tools.map((tool) =>
    tool.name === name
      ? {
          ...tool,
          enabled,
          reason: enabled ? undefined : "Desativado manualmente pelo painel",
        }
      : tool,
  );
  await writeState(user.id, state);
  await appendLog(user, "info", "Tool atualizada", { name, enabled });
  return state.tools.find((tool) => tool.name === name) ?? null;
}

export async function setFullAccess(user: SessionUser, enabled: boolean) {
  const settings = await readAppSettings();
  settings.fullAccess = enabled;
  await writeAppSettings(settings);

  const state = await readState(user.id);
  state.tools = state.tools.map((tool) =>
    tool.name === "file_write"
      ? {
          ...tool,
          enabled,
          reason: enabled ? "Acesso liberado para o computador inteiro" : "Modo seguro local",
        }
      : tool,
  );
  await writeState(user.id, state);
  await appendLog(user, "info", "Acesso total atualizado", { enabled });
  return settings;
}

export async function setPermissionMode(
  user: SessionUser,
  permissionMode: "ask" | "auto" | "read_only",
) {
  const settings = await readAppSettings();
  settings.permissionMode = permissionMode;
  await writeAppSettings(settings);

  await appendLog(user, "info", "Modo de permissao atualizado", { permissionMode });
  return settings;
}

export async function setMemoryMode(
  user: SessionUser,
  memoryMode: "off" | "explicit" | "smart",
) {
  const settings = await readAppSettings();
  settings.memoryMode = memoryMode;
  await writeAppSettings(settings);

  await appendLog(user, "info", "Modo de memoria atualizado", { memoryMode });
  return settings;
}

export async function setToolApproval(
  user: SessionUser,
  toolName: string,
  approved: boolean,
) {
  const settings = await readAppSettings();
  const normalizedTool = toolName.trim();
  settings.approvedTools = approved
    ? Array.from(new Set([...settings.approvedTools, normalizedTool]))
    : settings.approvedTools.filter((item) => item !== normalizedTool);
  await writeAppSettings(settings);
  await appendLog(user, "info", "Aprovacao de tool atualizada", {
    toolName: normalizedTool,
    approved,
  });
  return settings;
}

export async function setSandboxSettings(
  user: SessionUser,
  input: { enabled: boolean; writableRoots: string[] },
) {
  const settings = await readAppSettings();
  settings.sandboxEnabled = input.enabled;
  settings.sandboxWritableRoots = Array.from(
    new Set(
      input.writableRoots
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  );
  await writeAppSettings(settings);
  await appendLog(user, "info", "Sandbox atualizado", {
    enabled: settings.sandboxEnabled,
    writableRoots: settings.sandboxWritableRoots,
  });
  return settings;
}

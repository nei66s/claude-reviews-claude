import crypto from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import type { SessionUser } from "./auth";
import { dbQuery, findDbUserByEmail, hasDatabase } from "./db";

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

export async function invalidateConversationCacheForUser(user: SessionUser) {
  const ownerId = await resolveOwnerId(user);
  invalidateConversationsCache(ownerId);
}

export type ChatMessage = {
  id?: string;
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
  agentId?: string | null;
  helperAgentId?: string | null;
  handoffLabel?: string | null;
  collaborationLabel?: string | null;
  feedback?: "like" | "dislike" | null;
};

export type StoredConversation = {
  id: string;
  title: string;
  messages: ChatMessage[];
};

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
    const ownerId = await resolveOwnerId(user);

    // Verificar cache primeiro
    const cached = getCachedConversations(ownerId);
    if (cached) {
      return cached;
    }

    const conversationResult = await dbQuery<
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

    const messageResult = await dbQuery<
      ChatMessage & {
        id: string | number;
        conversation_id: string;
        sort_order: number;
        agentId: string | null;
        helperAgentId: string | null;
        handoffLabel: string | null;
        collaborationLabel: string | null;
        feedback: string | null;
      }
    >(
      `select m.conversation_id,
              m.id,
              m.sort_order,
              m.role,
              m.content,
              m.streaming,
              m.agent_id as "agentId",
              m.helper_agent_id as "helperAgentId",
              m.handoff_label as "handoffLabel",
              m.collaboration_label as "collaborationLabel",
              mf.feedback as feedback
       from public.messages m
       left join public.message_feedback mf
          on mf.message_id::text = m.id::text and mf.user_id = $2
       where m.conversation_id = any($1::text[])
       order by m.conversation_id asc, m.sort_order asc, m.id asc`,
      [ids, ownerId],
    );

    const messagesByConversation = new Map<string, ChatMessage[]>();
    for (const row of messageResult.rows) {
      const list = messagesByConversation.get(row.conversation_id) ?? [];
      const messageId = String(row.id);
      list.push({
        id: messageId,
        role: row.role,
        content: row.content,
        streaming: row.streaming,
        agentId: row.agentId ?? undefined,
        helperAgentId: row.helperAgentId ?? undefined,
        handoffLabel: row.handoffLabel ?? undefined,
        collaborationLabel: row.collaborationLabel ?? undefined,
        feedback: row.feedback === "like" || row.feedback === "dislike" ? row.feedback : null,
      });
      messagesByConversation.set(row.conversation_id, list);
    }

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
    const ownerId = await resolveOwnerId(user);
    const title = input.title?.trim() || "Nova conversa";
    await dbQuery(
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
    const ownerId = await resolveOwnerId(user);

    await dbQuery(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)
       on conflict (id)
       do update set title = excluded.title, owner_id = excluded.owner_id, updated_at = now()`,
      [conversation.id, conversation.title, ownerId],
    );

    await dbQuery("delete from public.messages where conversation_id = $1", [
      conversation.id,
    ]);

    for (const [index, message] of conversation.messages.entries()) {
      await dbQuery(
        `insert into public.messages (
           conversation_id,
           sort_order,
           role,
           content,
           streaming,
           agent_id,
           helper_agent_id,
           handoff_label,
           collaboration_label
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          conversation.id,
          index,
          message.role,
          message.content,
          Boolean(message.streaming),
          message.agentId ?? null,
          message.helperAgentId ?? null,
          message.handoffLabel ?? null,
          message.collaborationLabel ?? null,
        ],
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

export async function appendConversationMessages(
  user: SessionUser,
  conversationId: string,
  title: string,
  messages: ChatMessage[],
): Promise<{ insertedMessageIds: string[] }> {
  if (hasDatabase()) {
    const ownerId = await resolveOwnerId(user);

    await dbQuery(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)
       on conflict (id)
       do update set title = excluded.title, owner_id = excluded.owner_id, updated_at = now()`,
      [conversationId, title, ownerId],
    );

    const orderResult = await dbQuery<{ max_sort_order: number }>(
      `select coalesce(max(sort_order), -1) as max_sort_order
       from public.messages
       where conversation_id = $1`,
      [conversationId],
    );

    const maxSortOrder = orderResult.rows[0]?.max_sort_order ?? -1;
    const insertedMessageIds: string[] = [];

    for (const [index, message] of messages.entries()) {
      const insertResult = await dbQuery<{ id: string }>(
        `insert into public.messages (
           conversation_id,
           sort_order,
           role,
           content,
           streaming,
           agent_id,
           helper_agent_id,
           handoff_label,
           collaboration_label
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         returning id::text as id`,
        [
          conversationId,
          maxSortOrder + index + 1,
          message.role,
          message.content,
          Boolean(message.streaming),
          message.agentId ?? null,
          message.helperAgentId ?? null,
          message.handoffLabel ?? null,
          message.collaborationLabel ?? null,
        ],
      );

      if (insertResult.rows[0]?.id) {
        insertedMessageIds.push(insertResult.rows[0].id);
      }
    }

    invalidateConversationsCache(ownerId);
    await appendLog(user, "info", "Mensagens adicionadas", {
      id: conversationId,
      count: messages.length,
    });

    return { insertedMessageIds };
  }

  const state = await readState(user.id);
  const existing = state.conversations.find((item) => item.id === conversationId);
  const nextConversation: StoredConversation = existing
    ? { ...existing, title, messages: [...existing.messages, ...messages] }
    : { id: conversationId, title, messages: [...messages] };

  state.conversations = [
    nextConversation,
    ...state.conversations.filter((item) => item.id !== conversationId),
  ];
  await writeState(user.id, state);
  await appendLog(user, "info", "Mensagens adicionadas", { id: conversationId, count: messages.length });
  return { insertedMessageIds: [] };
}

export async function deleteConversation(user: SessionUser, conversationId: string) {
  if (hasDatabase()) {
    const ownerId = await resolveOwnerId(user);

    await dbQuery(
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
    const ownerId = await resolveOwnerId(user);
    await dbQuery(
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
    const ownerId = await resolveOwnerId(user);
    const conversationResult = await dbQuery<
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
    await dbQuery(
      `insert into public.conversations (id, title, owner_id)
       values ($1, $2, $3)`,
      [nextId, copyTitle, ownerId],
    );

    const messages = await dbQuery<
      ChatMessage & { sort_order: number }
    >(
      `select sort_order,
              role,
              content,
              streaming,
              agent_id as "agentId",
              helper_agent_id as "helperAgentId",
              handoff_label as "handoffLabel",
              collaboration_label as "collaborationLabel"
       from public.messages
       where conversation_id = $1
       order by sort_order asc, id asc`,
      [sourceId],
    );

    for (const message of messages.rows) {
      await dbQuery(
        `insert into public.messages (
           conversation_id,
           sort_order,
           role,
           content,
           streaming,
           agent_id,
           helper_agent_id,
           handoff_label,
           collaboration_label
         )
         values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          nextId,
          message.sort_order,
          message.role,
          message.content,
          Boolean(message.streaming),
          message.agentId ?? null,
          message.helperAgentId ?? null,
          message.handoffLabel ?? null,
          message.collaborationLabel ?? null,
        ],
      );
    }

    invalidateConversationsCache(ownerId);
    await appendLog(user, "info", "Conversa duplicada", { sourceId, nextId });
    return {
      id: nextId,
      title: copyTitle,
      messages: messages.rows.map((message) => ({
        role: message.role,
        content: message.content,
        streaming: Boolean(message.streaming),
        agentId: message.agentId ?? undefined,
        helperAgentId: message.helperAgentId ?? undefined,
        handoffLabel: message.handoffLabel ?? undefined,
        collaborationLabel: message.collaborationLabel ?? undefined,
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

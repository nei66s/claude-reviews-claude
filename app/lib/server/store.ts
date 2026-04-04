import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import type { SessionUser } from "./auth";
import { findDbUserByEmail, getDb, hasDatabase } from "./db";

export type ChatMessage = {
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
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
  approvedTools: string[];
  sandboxEnabled: boolean;
  sandboxWritableRoots: string[];
};

const DATA_DIR = path.join(process.cwd(), ".chocks-local");
const APP_SETTINGS_PATH = path.join(DATA_DIR, "app-settings.json");

const defaultPlugins = (): PluginRecord[] => [
  {
    id: "vercel",
    name: "Vercel",
    description: "Integração local simulada para restaurar a interface.",
    enabled: true,
    capabilities: [
      {
        type: "skill",
        name: "Deployments",
        description: "Mostra o plugin como habilitado no painel.",
      },
      {
        type: "mcp",
        name: "Toolbar",
        description: "Exibe recursos de integração disponíveis.",
      },
    ],
  },
];

const defaultTools = (): ToolRecord[] => [
  { name: "file_read", enabled: true, category: "filesystem" },
  { name: "file_write", enabled: false, category: "filesystem", reason: "Modo seguro local" },
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
    approvedTools: [],
    sandboxEnabled: true,
    sandboxWritableRoots: [],
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
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
  return path.join(DATA_DIR, `${userId}.json`);
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
  await ensureDataDir();
  try {
    const raw = await fs.readFile(APP_SETTINGS_PATH, "utf8");
    const parsed = JSON.parse(raw) as Partial<AppSettings>;
    return {
      fullAccess: Boolean(parsed.fullAccess),
      permissionMode:
        parsed.permissionMode === "auto" || parsed.permissionMode === "read_only"
          ? parsed.permissionMode
          : "ask",
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
  await ensureDataDir();
  await fs.writeFile(APP_SETTINGS_PATH, JSON.stringify(settings, null, 2), "utf8");
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
      return [];
    }

    const messageResult = await db.query<
      ChatMessage & { conversation_id: string; sort_order: number }
    >(
      `select conversation_id, sort_order, role, content, streaming
       from public.messages
       where conversation_id = any($1::text[])
       order by conversation_id asc, sort_order asc, id asc`,
      [ids],
    );

    const messagesByConversation = new Map<string, ChatMessage[]>();
    for (const row of messageResult.rows) {
      const list = messagesByConversation.get(row.conversation_id) ?? [];
      list.push({
        role: row.role,
        content: row.content,
        streaming: row.streaming,
      });
      messagesByConversation.set(row.conversation_id, list);
    }

    return conversationResult.rows.map(
      (conversation: Pick<StoredConversation, "id" | "title">) => ({
        id: conversation.id,
        title: conversation.title,
        messages: messagesByConversation.get(conversation.id) ?? [],
      }),
    );
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
      await db.query(
        `insert into public.messages (conversation_id, sort_order, role, content, streaming)
         values ($1, $2, $3, $4, $5)`,
        [
          conversation.id,
          index,
          message.role,
          message.content,
          Boolean(message.streaming),
        ],
      );
    }

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
      ChatMessage & { sort_order: number }
    >(
      `select sort_order, role, content, streaming
       from public.messages
       where conversation_id = $1
       order by sort_order asc, id asc`,
      [sourceId],
    );

    for (const message of messages.rows) {
      await db.query(
        `insert into public.messages (conversation_id, sort_order, role, content, streaming)
         values ($1, $2, $3, $4, $5)`,
        [nextId, message.sort_order, message.role, message.content, Boolean(message.streaming)],
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

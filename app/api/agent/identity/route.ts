import { dbQuery, hasDatabase, isDatabaseBusyError } from "@/lib/server/db";

export type AgentIdentity = {
  name: string;
  emoji: string;
  nickname: string;
  relationship: string;
  ageMonths: number;
  description: string;
};

type DbAgentProfile = Partial<AgentIdentity> & {
  greetings?: unknown;
};

const DEFAULT_AGENT_ID = "chocks";
const DEFAULT_IDENTITY: AgentIdentity = {
  name: "Chocks",
  emoji: "🐾",
  nickname: "Chokito",
  relationship: "Seu parceiro de missão",
  ageMonths: 18,
  description: "Assistente direto, útil e sem enrolação — parte da família Pimpotasma.",
};

declare global {
  // eslint-disable-next-line no-var
  var __chocksAgentIdentityTableEnsured: Promise<void> | undefined;
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function coerceIdentity(profile: unknown): AgentIdentity | null {
  if (!profile || typeof profile !== "object") return null;
  const p = profile as DbAgentProfile;

  const name = asString(p.name);
  const emoji = asString(p.emoji);
  const nickname = asString(p.nickname);
  const relationship = asString(p.relationship);
  const ageMonths = asNumber(p.ageMonths);
  const description = asString(p.description);

  if (!name || !emoji || !nickname || !relationship || ageMonths === null || !description) {
    return null;
  }

  return { name, emoji, nickname, relationship, ageMonths, description };
}

async function ensureProfileRow(agentId: string) {
  if (!global.__chocksAgentIdentityTableEnsured) {
    global.__chocksAgentIdentityTableEnsured = dbQuery(
      `CREATE TABLE IF NOT EXISTS public.coordination_agent_profiles (
        agent_id TEXT PRIMARY KEY,
        profile JSONB NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`,
    ).then(() => undefined);
  }

  await global.__chocksAgentIdentityTableEnsured;

  await dbQuery(
    `INSERT INTO public.coordination_agent_profiles (agent_id, profile, created_at, updated_at)
     VALUES ($1, $2, NOW(), NOW())
     ON CONFLICT (agent_id) DO NOTHING`,
    [agentId, DEFAULT_IDENTITY],
  );
}

export async function GET() {
  if (!hasDatabase()) {
    return Response.json({ agent: DEFAULT_IDENTITY });
  }

  try {
    const agentId = DEFAULT_AGENT_ID;
    await ensureProfileRow(agentId);

    const res = await dbQuery<{ profile: unknown }>(
      `SELECT profile
       FROM public.coordination_agent_profiles
       WHERE agent_id = $1
       LIMIT 1`,
      [agentId],
    );

    const fromDb = coerceIdentity(res.rows[0]?.profile);
    return Response.json({ agent: fromDb ?? DEFAULT_IDENTITY });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return Response.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    throw error;
  }
}

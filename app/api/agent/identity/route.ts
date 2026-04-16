import { getDb, hasDatabase } from "@/lib/server/db";

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
  const db = getDb();
  await db.query(
    `CREATE TABLE IF NOT EXISTS public.coordination_agent_profiles (
      agent_id TEXT PRIMARY KEY,
      profile JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`,
  );

  await db.query(
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

  const agentId = DEFAULT_AGENT_ID;
  await ensureProfileRow(agentId);

  const db = getDb();
  const res = await db.query<{ profile: unknown }>(
    `SELECT profile
     FROM public.coordination_agent_profiles
     WHERE agent_id = $1
     LIMIT 1`,
    [agentId],
  );

  const fromDb = coerceIdentity(res.rows[0]?.profile);
  return Response.json({ agent: fromDb ?? DEFAULT_IDENTITY });
}

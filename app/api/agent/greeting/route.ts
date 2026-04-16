import { dbQuery, hasDatabase } from "@/lib/server/db";

const DEFAULT_AGENT_ID = "chocks";
const DEFAULT_GREETINGS = [
  "E aí! Bora resolver isso juntos?",
  "Cheguei — me diz o que você quer fazer e eu toco o resto.",
  "Pronto pra missão. Manda o contexto.",
  "Vamos nessa. O que tá pegando?",
];

function pickGreeting(greetings: string[], seed: number) {
  const idx = Math.abs(seed) % greetings.length;
  return greetings[idx] ?? greetings[0] ?? "Oi!";
}

function coerceGreetingList(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const items = value.filter((item) => typeof item === "string") as string[];
  return items.length > 0 ? items : null;
}

export async function GET() {
  const now = new Date();
  const seed = now.getUTCFullYear() * 10000 + (now.getUTCMonth() + 1) * 100 + now.getUTCDate();

  if (!hasDatabase()) {
    return Response.json({ greeting: pickGreeting(DEFAULT_GREETINGS, seed) });
  }

  let greetings = DEFAULT_GREETINGS;
  try {
    const res = await dbQuery<{ profile: unknown }>(
      `SELECT profile
       FROM public.coordination_agent_profiles
       WHERE agent_id = $1
       LIMIT 1`,
      [DEFAULT_AGENT_ID],
    );

    const profile = res.rows[0]?.profile as { greetings?: unknown } | undefined;
    greetings = coerceGreetingList(profile?.greetings) ?? DEFAULT_GREETINGS;
  } catch {
    greetings = DEFAULT_GREETINGS;
  }

  return Response.json({ greeting: pickGreeting(greetings, seed) });
}

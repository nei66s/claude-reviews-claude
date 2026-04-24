
import { hasDatabase, dbQuery } from "../db";

let schemaReady: Promise<void> | null = null;

async function ensureAgentRoomSchema() {
  if (!hasDatabase()) return;
  if (schemaReady) return schemaReady;

  schemaReady = (async () => {
    try {
      await dbQuery(`
        CREATE TABLE IF NOT EXISTS public.agent_room_sessions (
          id TEXT PRIMARY KEY,
          synergy_score INT NOT NULL DEFAULT 80,
          current_topic TEXT,
          last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS public.agent_room_messages (
          id BIGSERIAL PRIMARY KEY,
          session_id TEXT NOT NULL REFERENCES public.agent_room_sessions(id) ON DELETE CASCADE,
          role TEXT NOT NULL CHECK (role IN ('agent', 'user', 'system')),
          agent_id TEXT,
          content TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );

        CREATE INDEX IF NOT EXISTS idx_agent_room_msg_session_id ON public.agent_room_messages(session_id, created_at ASC);
      `);
    } catch (err) {
      console.error("[AgentRoomRepository] Schema failed:", err);
      schemaReady = null;
    }
  })();

  return schemaReady;
}

export async function persistRoomMessage(sessionId: string, message: { role: string, agentId?: string, content: string }) {
  await ensureAgentRoomSchema();
  if (!hasDatabase()) return;

  try {
    // Upsert session
    await dbQuery(`
      INSERT INTO public.agent_room_sessions (id, last_activity_at)
      VALUES ($1, NOW())
      ON CONFLICT (id) DO UPDATE SET last_activity_at = NOW()
    `, [sessionId]);

    // Insert message
    await dbQuery(`
      INSERT INTO public.agent_room_messages (session_id, role, agent_id, content)
      VALUES ($1, $2, $3, $4)
    `, [sessionId, message.role, message.agentId || null, message.content]);
  } catch (err) {
    console.error("[AgentRoomRepository] Persist failed:", err);
  }
}

export async function getRoomHistory(sessionId: string, limit = 30) {
  await ensureAgentRoomSchema();
  if (!hasDatabase()) return [];

  try {
    const result = await dbQuery(`
      SELECT role, agent_id as "agentId", content, created_at as "timestamp"
      FROM public.agent_room_messages
      WHERE session_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `, [sessionId, limit]);

    return result.rows.reverse();
  } catch (err) {
    console.error("[AgentRoomRepository] Get history failed:", err);
    return [];
  }
}

export async function getLastMessageTimestamp(sessionId: string) {
  await ensureAgentRoomSchema();
  if (!hasDatabase()) return null;

  try {
    const result = await dbQuery(`
      SELECT created_at 
      FROM public.agent_room_messages 
      WHERE session_id = $1 
      ORDER BY created_at DESC 
      LIMIT 1
    `, [sessionId]);

    return result.rows[0]?.created_at || null;
  } catch (err) {
    console.error("[AgentRoomRepository] Get last timestamp failed:", err);
    return null;
  }
}

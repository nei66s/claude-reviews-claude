/**
 * Coordination Agent Profiles
 * Persist full agent profiles (including system prompts) in Postgres.
 */
import { query } from '../db.js';
export async function initCoordinationAgentProfileTables() {
    await query(`
    CREATE TABLE IF NOT EXISTS coordination_agent_profiles (
      agent_id TEXT PRIMARY KEY,
      profile JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coordination_agent_profiles_updated_at
      ON coordination_agent_profiles(updated_at DESC);
  `);
}
export async function upsertAgentProfile(agentId, profile) {
    const normalized = String(agentId || '').trim();
    if (!normalized)
        throw new Error('agentId required');
    await query(`INSERT INTO coordination_agent_profiles (agent_id, profile)
     VALUES ($1, $2)
     ON CONFLICT (agent_id) DO UPDATE SET
       profile = EXCLUDED.profile,
       updated_at = NOW()`, [normalized, JSON.stringify(profile)]);
}
export async function getAgentProfile(agentId) {
    const normalized = String(agentId || '').trim();
    if (!normalized)
        return null;
    const result = await query(`SELECT agent_id, profile, created_at, updated_at
     FROM coordination_agent_profiles
     WHERE agent_id = $1
     LIMIT 1`, [normalized]);
    const row = result.rows[0];
    if (!row)
        return null;
    return {
        agentId: row.agent_id,
        profile: row.profile,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    };
}
export async function listAgentProfiles(prefix) {
    const normalizedPrefix = typeof prefix === 'string' ? prefix.trim() : '';
    const result = normalizedPrefix
        ? await query(`SELECT agent_id, profile, created_at, updated_at
         FROM coordination_agent_profiles
         WHERE agent_id ILIKE $1
         ORDER BY agent_id ASC`, [`${normalizedPrefix}%`])
        : await query(`SELECT agent_id, profile, created_at, updated_at
         FROM coordination_agent_profiles
         ORDER BY agent_id ASC`);
    return result.rows.map((row) => ({
        agentId: row.agent_id,
        profile: row.profile,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
    }));
}

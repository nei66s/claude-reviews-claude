/**
 * Hook System Persistence Layer — Save/load hooks to/from PostgreSQL
 * Enables hooks to survive server restart and be managed via API
 */
import { query } from '../db.js';
/**
 * Initialize hooks tables in database
 */
export async function initHookTables() {
    await query(`
    CREATE TABLE IF NOT EXISTS swarm_hooks (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL CHECK (category IN ('team', 'message', 'permission', 'plan')),
      event TEXT NOT NULL,
      hook_type TEXT NOT NULL CHECK (hook_type IN ('pre', 'post', 'error')),
      payload_json JSONB NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_swarm_hooks_category ON swarm_hooks(category);
    CREATE INDEX IF NOT EXISTS idx_swarm_hooks_event ON swarm_hooks(event);
    CREATE INDEX IF NOT EXISTS idx_swarm_hooks_enabled ON swarm_hooks(enabled);
  `);
}
/**
 * Load all hooks from database
 */
export async function loadHooks() {
    const res = await query(`SELECT id, category, event, hook_type, payload_json, enabled, created_at, updated_at
     FROM swarm_hooks WHERE enabled = TRUE ORDER BY created_at ASC`);
    return res.rows;
}
/**
 * Load hooks for a specific category
 */
export async function loadHooksByCategory(category) {
    const res = await query(`SELECT id, category, event, hook_type, payload_json, enabled, created_at, updated_at
     FROM swarm_hooks WHERE category = $1 AND enabled = TRUE ORDER BY created_at ASC`, [category]);
    return res.rows;
}
/**
 * Save a hook to database
 */
export async function saveHook(id, category, event, hookType, payloadJson) {
    await query(`INSERT INTO swarm_hooks (id, category, event, hook_type, payload_json, enabled)
     VALUES ($1, $2, $3, $4, $5, TRUE)
     ON CONFLICT (id) DO UPDATE SET
       category = $2, event = $3, hook_type = $4, payload_json = $5, updated_at = NOW()`, [id, category, event, hookType, JSON.stringify(payloadJson)]);
}
/**
 * Delete a hook from database
 */
export async function deleteHook(id) {
    await query('DELETE FROM swarm_hooks WHERE id = $1', [id]);
}
/**
 * Disable a hook (soft delete)
 */
export async function disableHook(id) {
    await query('UPDATE swarm_hooks SET enabled = FALSE, updated_at = NOW() WHERE id = $1', [id]);
}
/**
 * Enable a hook
 */
export async function enableHook(id) {
    await query('UPDATE swarm_hooks SET enabled = TRUE, updated_at = NOW() WHERE id = $1', [id]);
}

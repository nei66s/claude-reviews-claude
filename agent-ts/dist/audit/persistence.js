/**
 * Audit Log Persistence — Save full audit logs to PostgreSQL
 * Replaces in-memory 10K limit with unlimited database storage
 */
import { query } from '../db.js';
/**
 * Initialize audit log table in database
 */
export async function initAuditLogTable() {
    await query(`
    CREATE TABLE IF NOT EXISTS audit_log_entries (
      id BIGSERIAL PRIMARY KEY,
      chat_id TEXT NOT NULL,
      user_id TEXT,
      action TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      resource_id TEXT,
      status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'denied')),
      reason TEXT,
      details_json JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_audit_log_chat_id ON audit_log_entries(chat_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_user_id ON audit_log_entries(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log_entries(created_at);
    CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log_entries(action);
  `);
}
/**
 * Log an audit entry to database
 */
export async function logAuditEntry(chatId, action, resourceType, status, opts) {
    const res = await query(`INSERT INTO audit_log_entries (chat_id, user_id, action, resource_type, resource_id, status, reason, details_json)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING id`, [chatId, opts?.userId, action, resourceType, opts?.resourceId, status, opts?.reason, opts?.detailsJson ? JSON.stringify(opts.detailsJson) : null]);
    return res.rows[0]?.id ?? 0n;
}
/**
 * Fetch audit logs for a specific chat
 */
export async function getAuditLogsForChat(chatId, limit = 100, offset = 0) {
    const res = await query(`SELECT id, chat_id, user_id, action, resource_type, resource_id, status, reason, details_json, created_at
     FROM audit_log_entries
     WHERE chat_id = $1
     ORDER BY created_at DESC
     LIMIT $2 OFFSET $3`, [chatId, limit, offset]);
    return res.rows;
}
/**
 * Fetch audit logs by action type
 */
export async function getAuditLogsByAction(action, limit = 100) {
    const res = await query(`SELECT id, chat_id, user_id, action, resource_type, resource_id, status, reason, details_json, created_at
     FROM audit_log_entries
     WHERE action = $1
     ORDER BY created_at DESC
     LIMIT $2`, [action, limit]);
    return res.rows;
}
/**
 * Fetch denied actions only (security review)
 */
export async function getDeniedActions(limit = 100) {
    const res = await query(`SELECT id, chat_id, user_id, action, resource_type, resource_id, status, reason, details_json, created_at
     FROM audit_log_entries
     WHERE status = 'denied'
     ORDER BY created_at DESC
     LIMIT $1`, [limit]);
    return res.rows;
}
/**
 * Get audit log statistics
 */
export async function getAuditLogStats() {
    const res = await query(`SELECT status, COUNT(*) as count, MAX(created_at) as last_entry
     FROM audit_log_entries
     GROUP BY status`);
    const stats = {
        total: 0,
        success: 0,
        failed: 0,
        denied: 0,
        lastEntry: undefined,
    };
    for (const row of res.rows) {
        stats.total += row.count;
        if (row.status === 'success')
            stats.success = row.count;
        if (row.status === 'failed')
            stats.failed = row.count;
        if (row.status === 'denied')
            stats.denied = row.count;
        if (row.last_entry)
            stats.lastEntry = row.last_entry;
    }
    return stats;
}
/**
 * Cleanup old audit logs (keep last 90 days)
 */
export async function cleanupOldAuditLogs(daysToKeep = 90) {
    const res = await query(`DELETE FROM audit_log_entries WHERE created_at < NOW() - INTERVAL '${daysToKeep} days'`);
    return res.rowCount ?? 0;
}

/**
 * Permission Rules Persistence Layer — Save/load permission rules to/from PostgreSQL
 * Enables rules to survive server restart and be managed via API
 */

import { query } from '../db'
import type { DenyRule, AskRule } from './pipeline'

export interface PersistedDenyRule {
  id: string
  tool: string // Stored as comma-separated or JSON array
  condition_json: string // Serialized condition (lambda cannot be stored, so store metadata)
  reason: string
  created_at: Date
  updated_at: Date
}

export interface PersistedAskRule {
  id: string
  tool: string
  condition_json: string
  message: string
  created_at: Date
  updated_at: Date
}

/**
 * Initialize permission rules tables in database
 */
export async function initPermissionTables(): Promise<void> {
  await query(`
    CREATE TABLE IF NOT EXISTS permission_deny_rules (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      condition_json JSONB NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permission_ask_rules (
      id TEXT PRIMARY KEY,
      tool TEXT NOT NULL,
      condition_json JSONB NOT NULL,
      message TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS permission_approvals (
      id BIGSERIAL PRIMARY KEY,
      rule_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      approved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      UNIQUE (rule_id, chat_id)
    );

    CREATE INDEX IF NOT EXISTS idx_permission_approvals_chat_id ON permission_approvals(chat_id);
    CREATE INDEX IF NOT EXISTS idx_permission_approvals_expires_at ON permission_approvals(expires_at);
  `)
}

/**
 * Fetch all deny rules from database
 */
export async function loadDenyRules(): Promise<PersistedDenyRule[]> {
  const res = await query<PersistedDenyRule>(
    'SELECT id, tool, condition_json, reason, created_at, updated_at FROM permission_deny_rules ORDER BY created_at DESC'
  )
  return res.rows
}

/**
 * Fetch all ask rules from database
 */
export async function loadAskRules(): Promise<PersistedAskRule[]> {
  const res = await query<PersistedAskRule>(
    'SELECT id, tool, condition_json, message, created_at, updated_at FROM permission_ask_rules ORDER BY created_at DESC'
  )
  return res.rows
}

/**
 * Save a deny rule to database
 */
export async function saveDenyRule(
  id: string,
  tools: string | string[],
  conditionJson: any,
  reason: string
): Promise<void> {
  const toolsStr = Array.isArray(tools) ? tools.join(',') : tools
  await query(
    `INSERT INTO permission_deny_rules (id, tool, condition_json, reason)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       tool = $2, condition_json = $3, reason = $4, updated_at = NOW()`,
    [id, toolsStr, JSON.stringify(conditionJson), reason]
  )
}

/**
 * Save an ask rule to database
 */
export async function saveAskRule(
  id: string,
  tools: string | string[],
  conditionJson: any,
  message: string
): Promise<void> {
  const toolsStr = Array.isArray(tools) ? tools.join(',') : tools
  await query(
    `INSERT INTO permission_ask_rules (id, tool, condition_json, message)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (id) DO UPDATE SET
       tool = $2, condition_json = $3, message = $4, updated_at = NOW()`,
    [id, toolsStr, JSON.stringify(conditionJson), message]
  )
}

/**
 * Delete a deny rule from database
 */
export async function deleteDenyRule(id: string): Promise<void> {
  await query('DELETE FROM permission_deny_rules WHERE id = $1', [id])
}

/**
 * Delete an ask rule from database
 */
export async function deleteAskRule(id: string): Promise<void> {
  await query('DELETE FROM permission_ask_rules WHERE id = $1', [id])
}

/**
 * Record an approval for an ask rule (valid for 1 hour by default)
 */
export async function recordApproval(
  ruleId: string,
  chatId: string,
  expiresInMs: number = 3600000 // 1 hour
): Promise<void> {
  const expiresAt = new Date(Date.now() + expiresInMs)
  await query(
    `INSERT INTO permission_approvals (rule_id, chat_id, expires_at)
     VALUES ($1, $2, $3)
     ON CONFLICT (rule_id, chat_id) DO UPDATE SET
       expires_at = $3, approved_at = NOW()`,
    [ruleId, chatId, expiresAt]
  )
}

/**
 * Check if a rule is approved for a specific chat
 */
export async function isRuleApproved(ruleId: string, chatId: string): Promise<boolean> {
  const res = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM permission_approvals
     WHERE rule_id = $1 AND chat_id = $2 AND (expires_at IS NULL OR expires_at > NOW())`,
    [ruleId, chatId]
  )
  return (res.rows[0]?.count ?? 0) > 0
}

/**
 * List all active approvals for a chat
 */
export async function listApprovalsForChat(chatId: string): Promise<any[]> {
  const res = await query(
    `SELECT rule_id, approved_at, expires_at FROM permission_approvals
     WHERE chat_id = $1 AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY approved_at DESC`,
    [chatId]
  )
  return res.rows
}

/**
 * Revoke an approval
 */
export async function revokeApproval(ruleId: string, chatId: string): Promise<void> {
  await query('DELETE FROM permission_approvals WHERE rule_id = $1 AND chat_id = $2', [
    ruleId,
    chatId,
  ])
}

/**
 * Cleanup expired approvals (run periodically)
 */
export async function cleanupExpiredApprovals(): Promise<number> {
  const res = await query(
    'DELETE FROM permission_approvals WHERE expires_at IS NOT NULL AND expires_at <= NOW()'
  )
  return res.rowCount ?? 0
}

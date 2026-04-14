/**
 * MCP (Model Context Protocol) Integration System
 * Base framework for registering and managing external tools
 * Enables workers to access external services/data sources
 */

import { query } from '../db.js'
import type { QueryResultRow } from 'pg'

export type MCPToolType = 'browser' | 'github' | 'slack' | 'database' | 'api' | 'custom'
export type MCPAuthType = 'none' | 'api_key' | 'oauth' | 'token' | 'custom'

export interface MCPTool extends QueryResultRow {
  id: string
  team_id: string | null
  name: string
  type: MCPToolType
  description: string
  enabled: boolean
  auth_type: MCPAuthType
  config: Record<string, unknown>
  source_url: string | null
  created_at: string
  updated_at: string
}

export interface MCPToolAccess extends QueryResultRow {
  id: string
  mcp_tool_id: string
  worker_agent_id: string | null // null = all workers
  team_id: string
  access_level: 'denied' | 'limited' | 'full'
  rate_limit: number | null // calls per hour, null = unlimited
  expires_at: string | null
  created_at: string
}

/**
 * Initialize MCP tables
 */
export async function initMCPTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS mcp_tools (
      id TEXT PRIMARY KEY,
      team_id TEXT REFERENCES coordination_teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('browser', 'github', 'slack', 'database', 'api', 'custom')),
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'oauth', 'token', 'custom')),
      config JSONB NOT NULL DEFAULT '{}',
      source_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, name)
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_access (
      id TEXT PRIMARY KEY,
      mcp_tool_id TEXT NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
      worker_agent_id TEXT,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      access_level TEXT NOT NULL CHECK (access_level IN ('denied', 'limited', 'full')) DEFAULT 'denied',
      rate_limit INT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id TEXT PRIMARY KEY,
      mcp_tool_id TEXT NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
      worker_agent_id TEXT NOT NULL,
      function_name TEXT NOT NULL,
      arguments JSONB,
      result JSONB,
      error_message TEXT,
      duration_ms INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_mcp_tools_team ON mcp_tools(team_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tools_type ON mcp_tools(type);
    CREATE INDEX IF NOT EXISTS idx_mcp_access_worker ON mcp_tool_access(worker_agent_id, access_level);
    CREATE INDEX IF NOT EXISTS idx_mcp_calls_tool ON mcp_tool_calls(mcp_tool_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_calls_worker ON mcp_tool_calls(worker_agent_id, created_at DESC);
  `)
}

/**
 * Register an MCP tool
 */
export async function registerMCPTool(
  name: string,
  type: MCPToolType,
  config: Record<string, unknown>,
  options?: {
    teamId?: string
    description?: string
    authType?: MCPAuthType
    sourceUrl?: string
  }
): Promise<string> {
  const toolId = `mcp-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO mcp_tools (id, team_id, name, type, description, auth_type, config, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      toolId,
      options?.teamId || null,
      name,
      type,
      options?.description || null,
      options?.authType || 'none',
      JSON.stringify(config),
      options?.sourceUrl || null,
    ]
  )

  return toolId
}

/**
 * Grant access to MCP tool for worker
 */
export async function grantToolAccess(
  toolId: string,
  teamId: string,
  workerAgentId: string | null, // null = all workers
  accessLevel: 'denied' | 'limited' | 'full' = 'limited',
  rateLimit?: number
): Promise<string> {
  const accessId = `access-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO mcp_tool_access (id, mcp_tool_id, worker_agent_id, team_id, access_level, rate_limit)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (mcp_tool_id, worker_agent_id, team_id) DO UPDATE
     SET access_level = EXCLUDED.access_level, rate_limit = EXCLUDED.rate_limit`,
    [accessId, toolId, workerAgentId, teamId, accessLevel, rateLimit || null]
  )

  return accessId
}

/**
 * Check if worker can access tool
 */
export async function canAccessTool(toolId: string, workerAgentId: string, teamId: string): Promise<boolean> {
  const result = await query<{ access_level: string; expires_at: string | null }>(
    `SELECT access_level, expires_at FROM mcp_tool_access
     WHERE mcp_tool_id = $1 AND team_id = $2
       AND (worker_agent_id = $3 OR worker_agent_id IS NULL)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY worker_agent_id DESC LIMIT 1`,
    [toolId, teamId, workerAgentId]
  )

  if (result.rows.length === 0) return false

  const access = result.rows[0]
  return access.access_level !== 'denied'
}

/**
 * Log MCP tool call
 */
export async function logMCPToolCall(
  toolId: string,
  workerAgentId: string,
  functionName: string,
  args: Record<string, unknown> | null,
  result: Record<string, unknown> | null,
  errorMessage: string | null,
  durationMs: number
): Promise<string> {
  const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO mcp_tool_calls (id, mcp_tool_id, worker_agent_id, function_name, arguments, result, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [
      callId,
      toolId,
      workerAgentId,
      functionName,
      JSON.stringify(args || {}),
      JSON.stringify(result || {}),
      errorMessage || null,
      durationMs,
    ]
  )

  return callId
}

/**
 * Get available tools for worker
 */
export async function getAvailableTools(teamId: string, workerAgentId: string): Promise<MCPTool[]> {
  const result = await query<MCPTool>(
    `SELECT DISTINCT m.* FROM mcp_tools m
     INNER JOIN mcp_tool_access a ON a.mcp_tool_id = m.id
     WHERE m.enabled = TRUE
       AND a.team_id = $1
       AND a.access_level != 'denied'
       AND (a.worker_agent_id = $2 OR a.worker_agent_id IS NULL)
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
     ORDER BY m.name ASC`,
    [teamId, workerAgentId]
  )

  return result.rows
}

/**
 * Get tool info
 */
export async function getMCPTool(toolId: string): Promise<MCPTool | null> {
  const result = await query<MCPTool>(`SELECT * FROM mcp_tools WHERE id = $1`, [toolId])

  return result.rows[0] || null
}

/**
 * List all MCP tools
 */
export async function listMCPTools(teamId?: string): Promise<MCPTool[]> {
  let sql = `SELECT * FROM mcp_tools WHERE enabled = TRUE`
  const params: unknown[] = []

  if (teamId) {
    sql += ` AND (team_id = $1 OR team_id IS NULL)`
    params.push(teamId)
  }

  const result = await query<MCPTool>(`${sql} ORDER BY type, name`, params)

  return result.rows
}

/**
 * Disable tool
 */
export async function disableMCPTool(toolId: string): Promise<void> {
  await query(`UPDATE mcp_tools SET enabled = FALSE, updated_at = NOW() WHERE id = $1`, [toolId])
}

/**
 * Get tool usage stats
 */
export async function getMCPToolStats(toolId: string): Promise<{
  totalCalls: number
  successfulCalls: number
  failedCalls: number
  avgDurationMs: number
}> {
  const result = await query<{
    totalCalls: number
    successfulCalls: number
    failedCalls: number
    avgDurationMs: number
  }>(
    `SELECT 
       COUNT(*) as totalCalls,
       COUNT(CASE WHEN error_message IS NULL THEN 1 END) as successfulCalls,
       COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as failedCalls,
       AVG(duration_ms) as avgDurationMs
     FROM mcp_tool_calls
     WHERE mcp_tool_id = $1`,
    [toolId]
  )

  const stats = result.rows[0] || {}
  return {
    totalCalls: stats.totalCalls || 0,
    successfulCalls: stats.successfulCalls || 0,
    failedCalls: stats.failedCalls || 0,
    avgDurationMs: Math.round(stats.avgDurationMs || 0),
  }
}

/**
 * Get recent tool calls
 */
export async function getRecentToolCalls(toolId: string, limit: number = 20) {
  const result = await query(
    `SELECT worker_agent_id, function_name, duration_ms, error_message, created_at
     FROM mcp_tool_calls
     WHERE mcp_tool_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [toolId, limit]
  )

  return result.rows
}

/**
 * Cleanup old tool calls
 */
export async function cleanupOldToolCalls(ageHours: number = 168): Promise<number> {
  const result = await query(
    `DELETE FROM mcp_tool_calls
     WHERE created_at < NOW() - INTERVAL '${ageHours} hours'
     RETURNING id`
  )

  return result.rows.length
}

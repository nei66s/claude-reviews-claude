/**
 * MCP (Model Context Protocol) Integration System
 * Base framework for registering and managing external tools
 * Enables workers to access external services/data sources
 */
import { query } from '../db.js';
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
  `);
}
/**
 * Register an MCP tool
 */
export async function registerMCPTool(name, type, config, options) {
    const toolId = `mcp-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO mcp_tools (id, team_id, name, type, description, auth_type, config, source_url)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        toolId,
        options?.teamId || null,
        name,
        type,
        options?.description || null,
        options?.authType || 'none',
        JSON.stringify(config),
        options?.sourceUrl || null,
    ]);
    return toolId;
}
/**
 * Grant access to MCP tool for worker
 */
export async function grantToolAccess(toolId, teamId, workerAgentId, // null = all workers
accessLevel = 'limited', rateLimit) {
    const accessId = `access-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO mcp_tool_access (id, mcp_tool_id, worker_agent_id, team_id, access_level, rate_limit)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (mcp_tool_id, worker_agent_id, team_id) DO UPDATE
     SET access_level = EXCLUDED.access_level, rate_limit = EXCLUDED.rate_limit`, [accessId, toolId, workerAgentId, teamId, accessLevel, rateLimit || null]);
    return accessId;
}
/**
 * Check if worker can access tool
 */
export async function canAccessTool(toolId, workerAgentId, teamId) {
    const result = await query(`SELECT access_level, expires_at FROM mcp_tool_access
     WHERE mcp_tool_id = $1 AND team_id = $2
       AND (worker_agent_id = $3 OR worker_agent_id IS NULL)
       AND (expires_at IS NULL OR expires_at > NOW())
     ORDER BY worker_agent_id DESC LIMIT 1`, [toolId, teamId, workerAgentId]);
    if (result.rows.length === 0)
        return false;
    const access = result.rows[0];
    return access.access_level !== 'denied';
}
/**
 * Log MCP tool call
 */
export async function logMCPToolCall(toolId, workerAgentId, functionName, args, result, errorMessage, durationMs) {
    const callId = `call-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO mcp_tool_calls (id, mcp_tool_id, worker_agent_id, function_name, arguments, result, error_message, duration_ms)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`, [
        callId,
        toolId,
        workerAgentId,
        functionName,
        JSON.stringify(args || {}),
        JSON.stringify(result || {}),
        errorMessage || null,
        durationMs,
    ]);
    return callId;
}
/**
 * Get available tools for worker
 */
export async function getAvailableTools(teamId, workerAgentId) {
    const result = await query(`SELECT DISTINCT m.* FROM mcp_tools m
     INNER JOIN mcp_tool_access a ON a.mcp_tool_id = m.id
     WHERE m.enabled = TRUE
       AND a.team_id = $1
       AND a.access_level != 'denied'
       AND (a.worker_agent_id = $2 OR a.worker_agent_id IS NULL)
       AND (a.expires_at IS NULL OR a.expires_at > NOW())
     ORDER BY m.name ASC`, [teamId, workerAgentId]);
    return result.rows;
}
/**
 * Get tool info
 */
export async function getMCPTool(toolId) {
    const result = await query(`SELECT * FROM mcp_tools WHERE id = $1`, [toolId]);
    return result.rows[0] || null;
}
/**
 * List all MCP tools
 */
export async function listMCPTools(teamId) {
    let sql = `SELECT * FROM mcp_tools WHERE enabled = TRUE`;
    const params = [];
    if (teamId) {
        sql += ` AND (team_id = $1 OR team_id IS NULL)`;
        params.push(teamId);
    }
    const result = await query(`${sql} ORDER BY type, name`, params);
    return result.rows;
}
/**
 * Disable tool
 */
export async function disableMCPTool(toolId) {
    await query(`UPDATE mcp_tools SET enabled = FALSE, updated_at = NOW() WHERE id = $1`, [toolId]);
}
/**
 * Get tool usage stats
 */
export async function getMCPToolStats(toolId) {
    const result = await query(`SELECT 
       COUNT(*) as totalCalls,
       COUNT(CASE WHEN error_message IS NULL THEN 1 END) as successfulCalls,
       COUNT(CASE WHEN error_message IS NOT NULL THEN 1 END) as failedCalls,
       AVG(duration_ms) as avgDurationMs
     FROM mcp_tool_calls
     WHERE mcp_tool_id = $1`, [toolId]);
    const stats = result.rows[0] || {};
    return {
        totalCalls: stats.totalCalls || 0,
        successfulCalls: stats.successfulCalls || 0,
        failedCalls: stats.failedCalls || 0,
        avgDurationMs: Math.round(stats.avgDurationMs || 0),
    };
}
/**
 * Get recent tool calls
 */
export async function getRecentToolCalls(toolId, limit = 20) {
    const result = await query(`SELECT worker_agent_id, function_name, duration_ms, error_message, created_at
     FROM mcp_tool_calls
     WHERE mcp_tool_id = $1
     ORDER BY created_at DESC
     LIMIT $2`, [toolId, limit]);
    return result.rows;
}
/**
 * Cleanup old tool calls
 */
export async function cleanupOldToolCalls(ageHours = 168) {
    const result = await query(`DELETE FROM mcp_tool_calls
     WHERE created_at < NOW() - INTERVAL '${ageHours} hours'
     RETURNING id`);
    return result.rows.length;
}

/**
 * Coordination Mailbox System
 * File-based mailbox replacement using BD for inter-agent communication
 * Supports: DMs, broadcasts, notifications, permission requests
 */
import { query, withTransaction } from '../db.js';
/**
 * Initialize coordination tables
 */
export async function initCoordinationTables() {
    await query(`
    CREATE TABLE IF NOT EXISTS coordination_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      leader_agent_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      config JSONB,
      UNIQUE(leader_agent_id)
    );

    CREATE TABLE IF NOT EXISTS coordination_agents (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('idle', 'working', 'blocked', 'completed')) DEFAULT 'idle',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS coordination_messages (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT, -- NULL means broadcast
      message_type TEXT NOT NULL CHECK (message_type IN (
        'direct_message', 'broadcast', 'idle_notification', 'permission_request',
        'permission_response', 'task_notification', 'error_notification'
      )),
      content TEXT NOT NULL,
      metadata JSONB,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coordination_messages_team_to ON coordination_messages(team_id, to_agent_id, read);
    CREATE INDEX IF NOT EXISTS idx_coordination_messages_from ON coordination_messages(from_agent_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_coordination_agents_team_status ON coordination_agents(team_id, status);
  `);
}
/**
 * Create a new team
 */
export async function createTeam(name, leaderAgentId, config) {
    const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO coordination_teams (id, name, leader_agent_id, config)
     VALUES ($1, $2, $3, $4)`, [teamId, name, leaderAgentId, JSON.stringify(config || {})]);
    // Register leader as the first agent
    await registerAgent(teamId, leaderAgentId, 'leader');
    return teamId;
}
/**
 * Register a new agent in the team
 */
export async function registerAgent(teamId, agentId, role) {
    const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO coordination_agents (id, team_id, agent_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, agent_id) DO UPDATE SET last_activity = NOW()`, [id, teamId, agentId, role]);
    return id;
}
/**
 * Send a message (DM or broadcast)
 */
export async function sendMessage(teamId, fromAgentId, toAgentId, // null for broadcast
messageType, content, metadata) {
    const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    await query(`INSERT INTO coordination_messages 
     (id, team_id, from_agent_id, to_agent_id, message_type, content, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`, [messageId, teamId, fromAgentId, toAgentId, messageType, content, JSON.stringify(metadata || {})]);
    return messageId;
}
/**
 * Get unread messages for an agent
 */
export async function getInbox(teamId, agentId) {
    const result = await query(`SELECT * FROM coordination_messages 
     WHERE team_id = $1 
       AND (to_agent_id = $2 OR to_agent_id IS NULL)
       AND read = FALSE
     ORDER BY created_at ASC`, [teamId, agentId]);
    return result.rows;
}
/**
 * Mark message as read
 */
export async function markAsRead(messageId) {
    await query(`UPDATE coordination_messages SET read = TRUE WHERE id = $1`, [messageId]);
}
/**
 * Mark multiple messages as read
 */
export async function markManyAsRead(messageIds) {
    if (messageIds.length === 0)
        return;
    const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',');
    await query(`UPDATE coordination_messages SET read = TRUE WHERE id IN (${placeholders})`, messageIds);
}
/**
 * Update agent status
 */
export async function updateAgentStatus(teamId, agentId, status) {
    await query(`UPDATE coordination_agents 
     SET status = $1, last_activity = NOW()
     WHERE team_id = $2 AND agent_id = $3`, [status, teamId, agentId]);
}
/**
 * Get all agents in a team
 */
export async function getTeamAgents(teamId) {
    const result = await query(`SELECT * FROM coordination_agents WHERE team_id = $1 ORDER BY created_at ASC`, [teamId]);
    return result.rows;
}
/**
 * Get team info
 */
export async function getTeam(teamId) {
    const result = await query(`SELECT * FROM coordination_teams WHERE id = $1`, [teamId]);
    return result.rows[0] || null;
}
/**
 * Get all teams for a leader
 */
export async function getTeamsByLeader(leaderAgentId) {
    const result = await query(`SELECT * FROM coordination_teams WHERE leader_agent_id = $1 ORDER BY created_at DESC`, [leaderAgentId]);
    return result.rows;
}
/**
 * Get all teams
 */
export async function getAllTeams() {
    const result = await query(`SELECT * FROM coordination_teams ORDER BY created_at DESC`);
    return result.rows;
}
/**
 * Delete a team (cleanup)
 */
export async function deleteTeam(teamId) {
    await withTransaction(async (client) => {
        await client.query(`DELETE FROM coordination_messages WHERE team_id = $1`, [teamId]);
        await client.query(`DELETE FROM coordination_agents WHERE team_id = $1`, [teamId]);
        await client.query(`DELETE FROM coordination_teams WHERE id = $1`, [teamId]);
    });
}
/**
 * Get message history
 */
export async function getMessageHistory(teamId, fromAgentId, toAgentId, limit = 100) {
    let sql = `SELECT * FROM coordination_messages WHERE team_id = $1`;
    const params = [teamId];
    if (fromAgentId) {
        sql += ` AND from_agent_id = $${params.length + 1}`;
        params.push(fromAgentId);
    }
    if (toAgentId) {
        sql += ` AND (to_agent_id = $${params.length + 1} OR to_agent_id IS NULL)`;
        params.push(toAgentId);
    }
    sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);
    const result = await query(sql, params);
    return result.rows.reverse();
}

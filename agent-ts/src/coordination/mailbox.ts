/**
 * Coordination Mailbox System
 * File-based mailbox replacement using BD for inter-agent communication
 * Supports: DMs, broadcasts, notifications, permission requests
 */

import { query, withTransaction } from '../db.js'
import type { QueryResultRow } from 'pg'

export type MessageType =
  | 'direct_message'
  | 'broadcast'
  | 'idle_notification'
  | 'permission_request'
  | 'permission_response'
  | 'task_notification'
  | 'error_notification'

export interface CoordinationMessage extends QueryResultRow {
  id: string
  team_id: string
  from_agent_id: string
  to_agent_id: string | null // null = to all (broadcast)
  message_type: MessageType
  content: string
  metadata: Record<string, unknown> | null
  read: boolean
  created_at: string
}

export interface CoordinationTeam extends QueryResultRow {
  id: string
  name: string
  leader_agent_id: string
  created_at: string
  config: Record<string, unknown> | null
}

export interface CoordinationAgent extends QueryResultRow {
  id: string
  team_id: string
  agent_id: string
  role: string
  status: 'idle' | 'working' | 'blocked' | 'completed'
  created_at: string
  last_activity: string
}

/**
 * Initialize coordination tables
 */
export async function initCoordinationTables() {
  // Backward-compat: older schemas enforced 1 team per leader. We now allow multiple teams per leader.
  await query(`ALTER TABLE IF EXISTS coordination_teams DROP CONSTRAINT IF EXISTS coordination_teams_leader_agent_id_key;`)

  await query(`
    CREATE TABLE IF NOT EXISTS coordination_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      leader_agent_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      config JSONB
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
  `)
}

/**
 * Create a new team
 */
export async function createTeam(name: string, leaderAgentId: string, config?: Record<string, unknown>) {
  const teamId = `team-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO coordination_teams (id, name, leader_agent_id, config)
     VALUES ($1, $2, $3, $4)`,
    [teamId, name, leaderAgentId, JSON.stringify(config || {})]
  )

  // Register leader as the first agent
  await registerAgent(teamId, leaderAgentId, 'leader')

  return teamId
}

/**
 * Register a new agent in the team
 */
export async function registerAgent(teamId: string, agentId: string, role: string) {
  const id = `agent-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO coordination_agents (id, team_id, agent_id, role)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (team_id, agent_id) DO UPDATE SET last_activity = NOW()`,
    [id, teamId, agentId, role]
  )

  return id
}

/**
 * Send a message (DM or broadcast)
 */
export async function sendMessage(
  teamId: string,
  fromAgentId: string,
  toAgentId: string | null, // null for broadcast
  messageType: MessageType,
  content: string,
  metadata?: Record<string, unknown>
) {
  const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO coordination_messages 
     (id, team_id, from_agent_id, to_agent_id, message_type, content, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [messageId, teamId, fromAgentId, toAgentId, messageType, content, JSON.stringify(metadata || {})]
  )

  return messageId
}

/**
 * Get unread messages for an agent
 */
export async function getInbox(teamId: string, agentId: string): Promise<CoordinationMessage[]> {
  const result = await query<CoordinationMessage>(
    `SELECT * FROM coordination_messages 
     WHERE team_id = $1 
       AND (to_agent_id = $2 OR to_agent_id IS NULL)
       AND read = FALSE
     ORDER BY created_at ASC`,
    [teamId, agentId]
  )

  return result.rows
}

/**
 * Mark message as read
 */
export async function markAsRead(messageId: string) {
  await query(`UPDATE coordination_messages SET read = TRUE WHERE id = $1`, [messageId])
}

/**
 * Mark multiple messages as read
 */
export async function markManyAsRead(messageIds: string[]) {
  if (messageIds.length === 0) return

  const placeholders = messageIds.map((_, i) => `$${i + 1}`).join(',')
  await query(`UPDATE coordination_messages SET read = TRUE WHERE id IN (${placeholders})`, messageIds)
}

/**
 * Update agent status
 */
export async function updateAgentStatus(teamId: string, agentId: string, status: 'idle' | 'working' | 'blocked' | 'completed') {
  await query(
    `UPDATE coordination_agents 
     SET status = $1, last_activity = NOW()
     WHERE team_id = $2 AND agent_id = $3`,
    [status, teamId, agentId]
  )
}

/**
 * Get all agents in a team
 */
export async function getTeamAgents(teamId: string): Promise<CoordinationAgent[]> {
  const result = await query<CoordinationAgent>(
    `SELECT * FROM coordination_agents WHERE team_id = $1 ORDER BY created_at ASC`,
    [teamId]
  )

  return result.rows
}

/**
 * Get team info
 */
export async function getTeam(teamId: string): Promise<CoordinationTeam | null> {
  const result = await query<CoordinationTeam>(`SELECT * FROM coordination_teams WHERE id = $1`, [teamId])

  return result.rows[0] || null
}

/**
 * Get all teams for a leader
 */
export async function getTeamsByLeader(leaderAgentId: string): Promise<CoordinationTeam[]> {
  const result = await query<CoordinationTeam>(
    `SELECT * FROM coordination_teams WHERE leader_agent_id = $1 ORDER BY created_at DESC`,
    [leaderAgentId]
  )

  return result.rows
}

/**
 * Get all teams
 */
export async function getAllTeams(): Promise<CoordinationTeam[]> {
  const result = await query<CoordinationTeam>(
    `SELECT * FROM coordination_teams ORDER BY created_at DESC`
  )

  return result.rows
}

/**
 * Delete a team (cleanup)
 */
export async function deleteTeam(teamId: string) {
  await withTransaction(async (client) => {
    await client.query(`DELETE FROM coordination_messages WHERE team_id = $1`, [teamId])
    await client.query(`DELETE FROM coordination_agents WHERE team_id = $1`, [teamId])
    await client.query(`DELETE FROM coordination_teams WHERE id = $1`, [teamId])
  })
}

/**
 * Get message history
 */
export async function getMessageHistory(
  teamId: string,
  fromAgentId?: string,
  toAgentId?: string,
  limit: number = 100
): Promise<CoordinationMessage[]> {
  let sql = `SELECT * FROM coordination_messages WHERE team_id = $1`
  const params: unknown[] = [teamId]

  if (fromAgentId) {
    sql += ` AND from_agent_id = $${params.length + 1}`
    params.push(fromAgentId)
  }

  if (toAgentId) {
    sql += ` AND (to_agent_id = $${params.length + 1} OR to_agent_id IS NULL)`
    params.push(toAgentId)
  }

  sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`
  params.push(limit)

  const result = await query<CoordinationMessage>(sql, params)

  return result.rows.reverse()
}

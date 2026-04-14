/**
 * Coordination System Tests
 * Tests for team creation, worker spawning, mailbox, and communication
 * 
 * NOTE: These tests are skipped by default because they require a live PostgreSQL database.
 * To run: start PostgreSQL and remove the `.skip` after `describe('Coordination System'`
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import {
  initCoordinationTables,
  createTeam,
  registerAgent,
  sendMessage,
  getInbox,
  markAsRead,
  updateAgentStatus,
  getTeamAgents,
  getTeam,
  getMessageHistory,
  deleteTeam,
  type CoordinationMessage,
} from '../src/coordination/mailbox.js'
import { spawnWorker, getTeamWorkers } from '../src/coordination/spawner.js'

let testTeamId: string

// Skip by default - requires DB connection
describe.skip('Coordination System', () => {
  beforeAll(async () => {
    // Initialize tables
    await initCoordinationTables()
  })

  afterAll(async () => {
    // Cleanup
    if (testTeamId) {
      await deleteTeam(testTeamId)
    }
  })

  describe('Team Creation', () => {
    it('should create a team', async () => {
      testTeamId = await createTeam('test-team-1', 'coordinator@test')
      expect(testTeamId).toBeDefined()
      expect(typeof testTeamId).toBe('string')
      expect(testTeamId).toMatch(/^team-/)
    })

    it('should retrieve team info', async () => {
      const team = await getTeam(testTeamId)
      expect(team).toBeDefined()
      expect(team?.name).toBe('test-team-1')
      expect(team?.leader_agent_id).toBe('coordinator@test')
    })
  })

  describe('Agent Registration', () => {
    it('should register an agent in team', async () => {
      const agentId = await registerAgent(testTeamId, 'researcher@test', 'researcher')
      expect(agentId).toBeDefined()
    })

    it('should list team agents', async () => {
      const agents = await getTeamAgents(testTeamId)
      expect(agents.length).toBeGreaterThan(0)
      expect(agents[0].team_id).toBe(testTeamId)
    })

    it('should get team workers with status', async () => {
      const workers = await getTeamWorkers(testTeamId)
      expect(workers.length).toBeGreaterThan(0)
      expect(workers[0]).toHaveProperty('statusReadable')
    })
  })

  describe('Messaging System', () => {
    it('should send a direct message', async () => {
      const messageId = await sendMessage(testTeamId, 'coordinator@test', 'researcher@test', 'direct_message', 'Hello researcher')

      expect(messageId).toBeDefined()
      expect(typeof messageId).toBe('string')
      expect(messageId).toMatch(/^msg-/)
    })

    it('should send a broadcast message', async () => {
      const messageId = await sendMessage(
        testTeamId,
        'coordinator@test',
        null, // null = broadcast
        'broadcast',
        'Team meeting in 5 minutes'
      )

      expect(messageId).toBeDefined()
    })

    it('should get inbox for agent', async () => {
      const inbox = await getInbox(testTeamId, 'researcher@test')
      expect(Array.isArray(inbox)).toBe(true)
      expect(inbox.length).toBeGreaterThan(0)
    })

    it('should mark message as read', async () => {
      const inbox = await getInbox(testTeamId, 'researcher@test')
      if (inbox.length > 0) {
        const messageId = inbox[0].id
        await markAsRead(messageId)

        const updatedInbox = await getInbox(testTeamId, 'researcher@test')
        const readMessage = updatedInbox.find((m) => m.id === messageId)
        expect(readMessage?.read).toBe(true)
      }
    })

    it('should get message history', async () => {
      const history = await getMessageHistory(testTeamId, 'coordinator@test', undefined, 50)
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBeGreaterThanOrEqual(0)
    })
  })

  describe('Worker Spawning', () => {
    it('should spawn a worker', async () => {
      const worker = await spawnWorker(testTeamId, 'coordinator@test', {
        role: 'tester',
        goal: 'Run all unit tests and report results',
        context: {
          testPath: './tests',
          framework: 'vitest',
        },
      })

      expect(worker).toBeDefined()
      expect(worker.role).toBe('tester')
      expect(worker.teamId).toBe(testTeamId)
      expect(worker.agentId).toMatch(/@/)
    })

    it('should update agent status', async () => {
      const workers = await getTeamAgents(testTeamId)
      const worker = workers.find((a) => a.role === 'tester')

      if (worker) {
        await updateAgentStatus(testTeamId, worker.agent_id, 'completed')

        const updated = await getTeam(testTeamId)
        expect(updated).toBeDefined()
      }
    })
  })

  describe('Message Types', () => {
    it('should send task_notification', async () => {
      const messageId = await sendMessage(
        testTeamId,
        'coordinator@test',
        'runner@test',
        'task_notification',
        'Please execute task X with these parameters...',
        {
          taskId: 'task-123',
          parameters: { timeout: 5000 },
        }
      )

      expect(messageId).toBeDefined()
    })

    it('should send error_notification', async () => {
      const messageId = await sendMessage(
        testTeamId,
        'runner@test',
        'coordinator@test',
        'error_notification',
        'Task failed: Permission denied',
        {
          errorCode: 'PERMISSION_DENIED',
          exitCode: 1,
        }
      )

      expect(messageId).toBeDefined()
    })

    it('should send permission_request', async () => {
      const messageId = await sendMessage(
        testTeamId,
        'worker@test',
        'coordinator@test',
        'permission_request',
        'Need approval to execute: bash_exec command',
        {
          toolName: 'bash_exec',
          command: 'npm test',
        }
      )

      expect(messageId).toBeDefined()
    })

    it('should send permission_response', async () => {
      const messageId = await sendMessage(
        testTeamId,
        'coordinator@test',
        'worker@test',
        'permission_response',
        'Permission granted for bash_exec',
        {
          toolName: 'bash_exec',
          approved: true,
        }
      )

      expect(messageId).toBeDefined()
    })
  })

  describe('Cleanup', () => {
    it('should delete team and all related data', async () => {
      const teamToDelete = await createTeam('test-cleanup-team', 'cleanup-coordinator')

      // Add some data
      await registerAgent(teamToDelete, 'agent-1', 'test')
      await sendMessage(teamToDelete, 'cleanup-coordinator', 'agent-1', 'direct_message', 'test')

      // Delete
      await deleteTeam(teamToDelete)

      // Verify it's gone
      const deletedTeam = await getTeam(teamToDelete)
      expect(deletedTeam).toBeNull()
    })
  })
})

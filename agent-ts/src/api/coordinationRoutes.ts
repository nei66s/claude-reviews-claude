/**
 * Coordination REST API Routes
 * POST /api/coordination/team/create - Create team
 * POST /api/coordination/team/{teamId}/spawn - Spawn worker
 * GET /api/coordination/team/{teamId}/inbox - Get inbox
 * POST /api/coordination/team/{teamId}/inbox/{messageId}/read - Mark as read
 * GET /api/coordination/team/{teamId}/agents - List team agents
 * POST /api/coordination/team/{teamId}/send - Send message
 */

import { Router, type Request, type Response } from 'express'
import {
  createTeam,
  getInbox,
  markAsRead,
  sendMessage,
  getTeamAgents,
  getTeam,
  getAllTeams,
  registerAgent,
  updateAgentStatus,
  getMessageHistory,
  deleteTeam,
} from '../coordination/index.js'
import { spawnWorker, getTeamWorkers } from '../coordination/spawner.js'
import { triageAgent } from '../llm.js'
import {
  ensureFamilyTeamExists,
  createFamilyWorkflow,
  createWorkflowFromTemplate,
  listFamilyMembers,
  WORKFLOW_TEMPLATES,
} from '../coordination/family-service.js'

const router = Router()

// Create a new team
router.post('/team/create', async (req: Request, res: Response) => {
  try {
    const { name, leaderAgentId, config } = req.body

    if (!name || !leaderAgentId) {
      return res.status(400).json({ error: 'Missing name or leaderAgentId' })
    }

    const teamId = await createTeam(name, leaderAgentId, config)

    res.json({ success: true, teamId })
  } catch (error) {
    console.error('Failed to create team', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get all teams
router.get('/team', async (req: Request, res: Response) => {
  try {
    const teams = await getAllTeams()
    res.json({ teams })
  } catch (error) {
    console.error('Failed to get teams', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get team info
router.get('/team/:teamId', async (req: Request, res: Response) => {
  try {
    const team = await getTeam(req.params.teamId as string)

    if (!team) {
      return res.status(404).json({ error: 'Team not found' })
    }

    res.json(team)
  } catch (error) {
    console.error('Failed to get team', error)
    res.status(500).json({ error: String(error) })
  }
})

// Register an agent in a team
router.post('/team/:teamId/register', async (req: Request, res: Response) => {
  try {
    const { agentId, role } = req.body

    if (!agentId || !role) {
      return res.status(400).json({ error: 'Missing agentId or role' })
    }

    const id = await registerAgent(req.params.teamId as string, agentId, role)

    res.json({ success: true, id })
  } catch (error) {
    console.error('Failed to register agent', error)
    res.status(500).json({ error: String(error) })
  }
})

// Spawn a new worker
router.post('/team/:teamId/spawn', async (req: Request, res: Response) => {
  try {
    const { coordinatorAgentId, role, goal, context } = req.body

    if (!coordinatorAgentId || !role || !goal) {
      return res.status(400).json({ error: 'Missing coordinatorAgentId, role, or goal' })
    }

    const worker = await spawnWorker(req.params.teamId as string, coordinatorAgentId, {
      role,
      goal,
      context,
    })

    res.json({ success: true, worker })
  } catch (error) {
    console.error('Failed to spawn worker', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get inbox for an agent
router.get('/team/:teamId/inbox/:agentId', async (req: Request, res: Response) => {
  try {
    const messages = await getInbox(req.params.teamId as string, req.params.agentId as string)

    res.json({ messages, count: messages.length })
  } catch (error) {
    console.error('Failed to get inbox', error)
    res.status(500).json({ error: String(error) })
  }
})

// Mark message as read
router.post('/team/:teamId/message/:messageId/read', async (req: Request, res: Response) => {
  try {
    await markAsRead(req.params.messageId as string)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to mark message as read', error)
    res.status(500).json({ error: String(error) })
  }
})

// Send a message
router.post('/team/:teamId/send', async (req: Request, res: Response) => {
  try {
    const { fromAgentId, toAgentId, messageType, content, metadata } = req.body

    if (!fromAgentId || !messageType || !content) {
      return res.status(400).json({ error: 'Missing fromAgentId, messageType, or content' })
    }

    const messageId = await sendMessage(req.params.teamId as string, fromAgentId, toAgentId || null, messageType, content, metadata)

    res.json({ success: true, messageId })
  } catch (error) {
    console.error('Failed to send message', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get all agents in team
router.get('/team/:teamId/agents', async (req: Request, res: Response) => {
  try {
    const agents = await getTeamWorkers(req.params.teamId as string)

    res.json({ agents, count: agents.length })
  } catch (error) {
    console.error('Failed to get team agents', error)
    res.status(500).json({ error: String(error) })
  }
})

// Update agent status
router.patch('/team/:teamId/agent/:agentId/status', async (req: Request, res: Response) => {
  try {
    const { status } = req.body

    if (!status || !['idle', 'working', 'blocked', 'completed'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' })
    }

    await updateAgentStatus(req.params.teamId as string, req.params.agentId as string, status)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to update agent status', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get message history
router.get('/team/:teamId/history', async (req: Request, res: Response) => {
  try {
    const { fromAgentId, toAgentId, limit } = req.query
    const messages = await getMessageHistory(
      req.params.teamId as string,
      String(fromAgentId || ''),
      String(toAgentId || ''),
      Number(limit) || 100
    )

    res.json({ messages, count: messages.length })
  } catch (error) {
    console.error('Failed to get message history', error)
    res.status(500).json({ error: String(error) })
  }
})

// Delete team
router.delete('/team/:teamId', async (req: Request, res: Response) => {
  try {
    await deleteTeam(req.params.teamId as string)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to delete team', error)
    res.status(500).json({ error: String(error) })
  }
})

// ============= PIMPOTASMA FAMILY AGENTS =============

// List all family members
router.get('/family/members', async (req: Request, res: Response) => {
  try {
    const members = listFamilyMembers()
    res.json({ members, count: members.length })
  } catch (error) {
    console.error('Failed to list family members', error)
    res.status(500).json({ error: String(error) })
  }
})

// Ensure family team exists or create it
router.post('/family/init', async (req: Request, res: Response) => {
  try {
    const team = await ensureFamilyTeamExists()
    res.json({ success: true, team })
  } catch (error) {
    console.error('Failed to initialize family team', error)
    res.status(500).json({ error: String(error) })
  }
})

// Create a workflow with family members
// Example: POST /api/coordination/family/workflow
// Body: { goal: "Lançar novo produto", steps: [{ agent: "pimpim", task: "..." }, ...] }
router.post('/family/workflow', async (req: Request, res: Response) => {
  try {
    const { goal, description, steps } = req.body

    if (!goal || !steps || !Array.isArray(steps)) {
      return res.status(400).json({ error: 'Missing goal or steps array' })
    }

    const workflow = await createFamilyWorkflow({ goal, description, steps })

    res.json({ success: true, workflow })
  } catch (error) {
    console.error('Failed to create family workflow', error)
    res.status(500).json({ error: String(error) })
  }
})

// List available workflow templates
router.get('/family/templates', async (req: Request, res: Response) => {
  try {
    const templates = Object.entries(WORKFLOW_TEMPLATES).map(([key, template]) => ({
      key,
      goal: template.goal,
      description: template.description,
      stepsCount: template.steps.length,
    }))

    res.json({ templates, count: templates.length })
  } catch (error) {
    console.error('Failed to list templates', error)
    res.status(500).json({ error: String(error) })
  }
})

// Create workflow from template
// Example: POST /api/coordination/family/workflow-template/launch_product
router.post('/family/workflow-template/:templateKey', async (req: Request, res: Response) => {
  try {
    const { templateKey } = req.params

    if (!templateKey) {
      return res.status(400).json({ error: 'Missing templateKey' })
    }

    const workflow = await createWorkflowFromTemplate(templateKey as keyof typeof WORKFLOW_TEMPLATES)

    res.json({ success: true, workflow })
  } catch (error) {
    console.error('Failed to create workflow from template', error)
    res.status(500).json({ error: String(error) })
  }
})

// Triage agent for a message
router.post('/triage', async (req: Request, res: Response) => {
  try {
    const { input, agents, previousAgentId } = req.body

    if (!input || !agents || !Array.isArray(agents)) {
      return res.status(400).json({ error: 'Missing input or agents array' })
    }

    const { agentId } = await triageAgent({ input, agents, previousAgentId })

    res.json({ agentId })
  } catch (error) {
    console.error('Failed to triage agent', error)
    res.status(500).json({ error: String(error) })
  }
})

export default router

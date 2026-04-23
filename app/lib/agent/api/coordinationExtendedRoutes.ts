/**
 * Extended Coordination REST API Routes
 * Includes workflow history, error handling, and MCP integration endpoints
 */

import { Router, type Request, type Response } from 'express'
import {
  // Workflow History
  startCoordinationWorkflow,
  addWorkflowSteps,
  assignStepToWorker,
  completeWorkflowStep,
  failWorkflowStep,
  getWorkflowHistory,
  getWorkflowSteps,
  getTeamWorkflowHistory,
  getWorkflowStats,
  // Error Handling
  logWorkerError,
  scheduleRetry,
  calculateBackoffDelay,
  getPendingRetries,
  shouldRetry,
  resolveError,
  getTeamErrorStats,
  getRecentErrors,
  escalateError,
  // MCP
  registerMCPTool,
  grantToolAccess,
  canAccessTool,
  logMCPToolCall,
  getAvailableTools,
  getMCPTool,
  listMCPTools,
  disableMCPTool,
  getMCPToolStats,
  getRecentToolCalls,
} from '../coordination/index'

const router = Router()

// ============ WORKFLOW HISTORY ENDPOINTS ============

// Start a new workflow
router.post('/team/:teamId/workflow/start', async (req: Request, res: Response) => {
  try {
    const { conversationId, goal, initiatedBy } = req.body

    if (!conversationId || !goal || !initiatedBy) {
      return res.status(400).json({ error: 'Missing conversationId, goal, or initiatedBy' })
    }

    const workflowId = await startCoordinationWorkflow(String(req.params.teamId), conversationId, goal, initiatedBy)

    res.json({ success: true, workflowId })
  } catch (error) {
    console.error('Failed to start workflow', error)
    res.status(500).json({ error: String(error) })
  }
})

// Add steps to workflow
router.post('/workflow/:workflowId/steps', async (req: Request, res: Response) => {
  try {
    const { steps } = req.body

    if (!Array.isArray(steps) || steps.some((s: any) => !s.stepId || !s.text)) {
      return res.status(400).json({ error: 'Invalid steps format' })
    }

    await addWorkflowSteps(String(req.params.workflowId), steps)

    res.json({ success: true, stepsAdded: steps.length })
  } catch (error) {
    console.error('Failed to add workflow steps', error)
    res.status(500).json({ error: String(error) })
  }
})

// Assign step to worker
router.post('/workflow/:workflowId/step/:stepId/assign', async (req: Request, res: Response) => {
  try {
    const { workerAgentId } = req.body

    if (!workerAgentId) {
      return res.status(400).json({ error: 'Missing workerAgentId' })
    }

    await assignStepToWorker(String(req.params.workflowId), String(req.params.stepId), workerAgentId)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to assign step', error)
    res.status(500).json({ error: String(error) })
  }
})

// Complete workflow step
router.post('/workflow/:workflowId/step/:stepId/complete', async (req: Request, res: Response) => {
  try {
    const { result } = req.body

    await completeWorkflowStep(String(req.params.workflowId), String(req.params.stepId), result || {})

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to complete workflow step', error)
    res.status(500).json({ error: String(error) })
  }
})

// Fail workflow step
router.post('/workflow/:workflowId/step/:stepId/fail', async (req: Request, res: Response) => {
  try {
    const { errorMessage } = req.body

    if (!errorMessage) {
      return res.status(400).json({ error: 'Missing errorMessage' })
    }

    await failWorkflowStep(String(req.params.workflowId), String(req.params.stepId), errorMessage)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to fail workflow step', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get workflow
router.get('/workflow/:workflowId', async (req: Request, res: Response) => {
  try {
    const workflow = await getWorkflowHistory(String(req.params.workflowId))

    if (!workflow) {
      return res.status(404).json({ error: 'Workflow not found' })
    }

    res.json(workflow)
  } catch (error) {
    console.error('Failed to get workflow', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get workflow steps
router.get('/workflow/:workflowId/steps', async (req: Request, res: Response) => {
  try {
    const steps = await getWorkflowSteps(String(req.params.workflowId))

    res.json({ steps, count: steps.length })
  } catch (error) {
    console.error('Failed to get workflow steps', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get team workflows
router.get('/team/:teamId/workflows', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 50
    const workflows = await getTeamWorkflowHistory(String(req.params.teamId), limit)

    res.json({ workflows, count: workflows.length })
  } catch (error) {
    console.error('Failed to get team workflows', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get workflow stats
router.get('/team/:teamId/workflow-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getWorkflowStats(String(req.params.teamId))

    res.json(stats)
  } catch (error) {
    console.error('Failed to get workflow stats', error)
    res.status(500).json({ error: String(error) })
  }
})

// ============ ERROR HANDLING ENDPOINTS ============

// Log worker error
router.post('/team/:teamId/error/log', async (req: Request, res: Response) => {
  try {
    const { workerAgentId, errorMessage, category, severity, maxRetries, stackTrace } = req.body

    if (!workerAgentId || !errorMessage) {
      return res.status(400).json({ error: 'Missing workerAgentId or errorMessage' })
    }

    const errorId = await logWorkerError(String(req.params.teamId), workerAgentId, errorMessage, {
      category,
      severity,
      maxRetries,
      stackTrace,
    })

    res.json({ success: true, errorId })
  } catch (error) {
    console.error('Failed to log error', error)
    res.status(500).json({ error: String(error) })
  }
})

// Schedule retry
router.post('/error/:errorId/retry', async (req: Request, res: Response) => {
  try {
    const { delaySeconds } = req.body

    await scheduleRetry(String(req.params.errorId), delaySeconds || 60)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to schedule retry', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get pending retries
router.get('/team/:teamId/pending-retries', async (req: Request, res: Response) => {
  try {
    const retries = await getPendingRetries()

    // Filter by team
    const teamRetries = retries.filter((r) => r.team_id === String(req.params.teamId))

    res.json({ retries: teamRetries, count: teamRetries.length })
  } catch (error) {
    console.error('Failed to get pending retries', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get error stats
router.get('/team/:teamId/error-stats', async (req: Request, res: Response) => {
  try {
    const stats = await getTeamErrorStats(String(req.params.teamId))

    res.json(stats)
  } catch (error) {
    console.error('Failed to get error stats', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get recent errors
router.get('/team/:teamId/recent-errors', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20
    const errors = await getRecentErrors(String(req.params.teamId), limit)

    res.json({ errors, count: errors.length })
  } catch (error) {
    console.error('Failed to get recent errors', error)
    res.status(500).json({ error: String(error) })
  }
})

// Resolve error
router.post('/error/:errorId/resolve', async (req: Request, res: Response) => {
  try {
    await resolveError(String(req.params.errorId))

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to resolve error', error)
    res.status(500).json({ error: String(error) })
  }
})

// Escalate error
router.post('/error/:errorId/escalate', async (req: Request, res: Response) => {
  try {
    await escalateError(String(req.params.errorId))

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to escalate error', error)
    res.status(500).json({ error: String(error) })
  }
})

// ============ MCP INTEGRATION ENDPOINTS ============

// Register MCP tool
router.post('/team/:teamId/mcp-tool/register', async (req: Request, res: Response) => {
  try {
    const { name, type, config, description, authType, sourceUrl } = req.body

    if (!name || !type || !config) {
      return res.status(400).json({ error: 'Missing name, type, or config' })
    }

    const toolId = await registerMCPTool(name, type, config, {
      teamId: String(req.params.teamId),
      description,
      authType,
      sourceUrl,
    })

    res.json({ success: true, toolId })
  } catch (error) {
    console.error('Failed to register MCP tool', error)
    res.status(500).json({ error: String(error) })
  }
})

// Grant tool access
router.post('/team/:teamId/mcp-tool/:toolId/access', async (req: Request, res: Response) => {
  try {
    const { workerAgentId, accessLevel, rateLimit } = req.body

    if (!accessLevel) {
      return res.status(400).json({ error: 'Missing accessLevel' })
    }

    const accessId = await grantToolAccess(
      String(req.params.toolId),
      String(req.params.teamId),
      workerAgentId || null,
      accessLevel,
      rateLimit
    )

    res.json({ success: true, accessId })
  } catch (error) {
    console.error('Failed to grant tool access', error)
    res.status(500).json({ error: String(error) })
  }
})

// Check access
router.post('/mcp-tool/:toolId/check-access', async (req: Request, res: Response) => {
  try {
    const { workerAgentId, teamId } = req.body

    if (!workerAgentId || !teamId) {
      return res.status(400).json({ error: 'Missing workerAgentId or teamId' })
    }

    const hasAccess = await canAccessTool(String(req.params.toolId), workerAgentId, teamId)

    res.json({ hasAccess })
  } catch (error) {
    console.error('Failed to check tool access', error)
    res.status(500).json({ error: String(error) })
  }
})

// List available tools
router.get('/team/:teamId/mcp-tools', async (req: Request, res: Response) => {
  try {
    const { workerAgentId } = req.query

    if (!workerAgentId) {
      return res.status(400).json({ error: 'Missing workerAgentId' })
    }

    const tools = await getAvailableTools(String(req.params.teamId), String(workerAgentId))

    res.json({ tools, count: tools.length })
  } catch (error) {
    console.error('Failed to list MCP tools', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get tool info
router.get('/mcp-tool/:toolId', async (req: Request, res: Response) => {
  try {
    const tool = await getMCPTool(String(req.params.toolId))

    if (!tool) {
      return res.status(404).json({ error: 'Tool not found' })
    }

    res.json(tool)
  } catch (error) {
    console.error('Failed to get MCP tool', error)
    res.status(500).json({ error: String(error) })
  }
})

// Log tool call
router.post('/mcp-tool/:toolId/log-call', async (req: Request, res: Response) => {
  try {
    const { workerAgentId, functionName, arguments: args, result, errorMessage, durationMs } = req.body

    if (!workerAgentId || !functionName) {
      return res.status(400).json({ error: 'Missing workerAgentId or functionName' })
    }

    await logMCPToolCall(String(req.params.toolId), workerAgentId, functionName, args, result, errorMessage, durationMs || 0)

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to log tool call', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get tool stats
router.get('/mcp-tool/:toolId/stats', async (req: Request, res: Response) => {
  try {
    const stats = await getMCPToolStats(String(req.params.toolId))

    res.json(stats)
  } catch (error) {
    console.error('Failed to get tool stats', error)
    res.status(500).json({ error: String(error) })
  }
})

// Get recent tool calls
router.get('/mcp-tool/:toolId/calls', async (req: Request, res: Response) => {
  try {
    const limit = Number(req.query.limit) || 20
    const calls = await getRecentToolCalls(String(req.params.toolId), limit)

    res.json({ calls, count: calls.length })
  } catch (error) {
    console.error('Failed to get tool calls', error)
    res.status(500).json({ error: String(error) })
  }
})

// Disable tool
router.post('/mcp-tool/:toolId/disable', async (req: Request, res: Response) => {
  try {
    await disableMCPTool(String(req.params.toolId))

    res.json({ success: true })
  } catch (error) {
    console.error('Failed to disable tool', error)
    res.status(500).json({ error: String(error) })
  }
})

export default router

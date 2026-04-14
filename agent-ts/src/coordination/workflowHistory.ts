/**
 * Workflow History System
 * Tracks workflow execution across coordination teams
 * Enables coordination-aware workflow persistence and analytics
 */

import { query, withTransaction } from '../db.js'
import type { QueryResultRow } from 'pg'

export type CoordinationWorkflowStatus = 'pending' | 'in_progress' | 'completed' | 'failed' | 'blocked'

export interface CoordinationWorkflowHistory extends QueryResultRow {
  id: string
  team_id: string
  conversation_id: string
  goal: string
  status: CoordinationWorkflowStatus
  summary: string | null
  result: Record<string, unknown> | null
  error_message: string | null
  initiated_by: string
  created_at: string
  updated_at: string
}

export interface WorkflowStepExecution extends QueryResultRow {
  id: string
  workflow_history_id: string
  step_id: string
  step_text: string
  assigned_worker: string | null
  status: 'pending' | 'in_progress' | 'completed' | 'failed'
  result: Record<string, unknown> | null
  error_message: string | null
  started_at: string | null
  completed_at: string | null
  sort_order: number
}

/**
 * Initialize workflow history tables
 */
export async function initWorkflowHistoryTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS coordination_workflow_history (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'blocked')) DEFAULT 'pending',
      summary TEXT,
      result JSONB,
      error_message TEXT,
      initiated_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workflow_step_executions (
      id TEXT PRIMARY KEY,
      workflow_history_id TEXT NOT NULL REFERENCES coordination_workflow_history(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      step_text TEXT NOT NULL,
      assigned_worker TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
      result JSONB,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      sort_order INTEGER NOT NULL,
      UNIQUE(workflow_history_id, step_id)
    );

    CREATE INDEX IF NOT EXISTS idx_coordination_workflow_team_status ON coordination_workflow_history(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_coordination_workflow_initiated_by ON coordination_workflow_history(initiated_by, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workflow_step_exec_worker ON workflow_step_executions(assigned_worker, status);
  `)
}

/**
 * Start a new workflow in coordination context
 */
export async function startCoordinationWorkflow(
  teamId: string,
  conversationId: string,
  goal: string,
  initiatedBy: string
): Promise<string> {
  const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  await query(
    `INSERT INTO coordination_workflow_history 
     (id, team_id, conversation_id, goal, status, initiated_by)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [workflowId, teamId, conversationId, goal, 'pending', initiatedBy]
  )

  return workflowId
}

/**
 * Add steps to workflow
 */
export async function addWorkflowSteps(
  workflowId: string,
  steps: Array<{ stepId: string; text: string }>
): Promise<void> {
  for (let i = 0; i < steps.length; i++) {
    const step = steps[i]
    const executionId = `exec-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 9)}`

    await query(
      `INSERT INTO workflow_step_executions 
       (id, workflow_history_id, step_id, step_text, status, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [executionId, workflowId, step.stepId, step.text, 'pending', i]
    )
  }
}

/**
 * Assign workflow step to worker
 */
export async function assignStepToWorker(
  workflowId: string,
  stepId: string,
  workerAgentId: string
): Promise<void> {
  await query(
    `UPDATE workflow_step_executions 
     SET assigned_worker = $1, status = $2, started_at = NOW()
     WHERE workflow_history_id = $3 AND step_id = $4`,
    [workerAgentId, 'in_progress', workflowId, stepId]
  )
}

/**
 * Mark step as completed
 */
export async function completeWorkflowStep(
  workflowId: string,
  stepId: string,
  result: Record<string, unknown>
): Promise<void> {
  await query(
    `UPDATE workflow_step_executions 
     SET status = $1, result = $2, completed_at = NOW()
     WHERE workflow_history_id = $3 AND step_id = $4`,
    ['completed', JSON.stringify(result), workflowId, stepId]
  )

  // Check if all steps are completed
  await tryCompleteWorkflow(workflowId)
}

/**
 * Mark step as failed
 */
export async function failWorkflowStep(
  workflowId: string,
  stepId: string,
  errorMessage: string
): Promise<void> {
  await query(
    `UPDATE workflow_step_executions 
     SET status = $1, error_message = $2, completed_at = NOW()
     WHERE workflow_history_id = $3 AND step_id = $4`,
    ['failed', errorMessage, workflowId, stepId]
  )

  // Mark workflow as failed
  await query(
    `UPDATE coordination_workflow_history 
     SET status = $1, error_message = $2, updated_at = NOW()
     WHERE id = $3`,
    ['failed', errorMessage, workflowId]
  )
}

/**
 * Try to complete workflow if all steps are done
 */
async function tryCompleteWorkflow(workflowId: string): Promise<void> {
  const result = await query<{ pending_count: number }>(
    `SELECT COUNT(*) as pending_count FROM workflow_step_executions 
     WHERE workflow_history_id = $1 AND status != $2`,
    [workflowId, 'completed']
  )

  const pendingSteps = result.rows[0]?.pending_count || 0

  if (pendingSteps === 0) {
    // All steps completed - aggregate results
    const stepsResult = await query<WorkflowStepExecution>(
      `SELECT * FROM workflow_step_executions 
       WHERE workflow_history_id = $1 ORDER BY sort_order ASC`,
      [workflowId]
    )

    const aggregatedResult = {
      totalSteps: stepsResult.rows.length,
      steps: stepsResult.rows.map((step) => ({
        stepId: step.step_id,
        stepText: step.step_text,
        status: step.status,
        result: step.result,
      })),
    }

    await query(
      `UPDATE coordination_workflow_history 
       SET status = $1, result = $2, updated_at = NOW()
       WHERE id = $3`,
      ['completed', JSON.stringify(aggregatedResult), workflowId]
    )
  }
}

/**
 * Get workflow history
 */
export async function getWorkflowHistory(workflowId: string): Promise<CoordinationWorkflowHistory | null> {
  const result = await query<CoordinationWorkflowHistory>(
    `SELECT * FROM coordination_workflow_history WHERE id = $1`,
    [workflowId]
  )

  return result.rows[0] || null
}

/**
 * Get all steps for a workflow
 */
export async function getWorkflowSteps(workflowId: string): Promise<WorkflowStepExecution[]> {
  const result = await query<WorkflowStepExecution>(
    `SELECT * FROM workflow_step_executions 
     WHERE workflow_history_id = $1 
     ORDER BY sort_order ASC`,
    [workflowId]
  )

  return result.rows
}

/**
 * Get team workflow history
 */
export async function getTeamWorkflowHistory(
  teamId: string,
  limit: number = 50
): Promise<CoordinationWorkflowHistory[]> {
  const result = await query<CoordinationWorkflowHistory>(
    `SELECT * FROM coordination_workflow_history 
     WHERE team_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [teamId, limit]
  )

  return result.rows
}

/**
 * Get workflow statistics
 */
export async function getWorkflowStats(teamId: string): Promise<{
  total: number
  completed: number
  failed: number
  inProgress: number
  blocked: number
}> {
  const result = await query<{ status: string; count: number }>(
    `SELECT status, COUNT(*) as count FROM coordination_workflow_history 
     WHERE team_id = $1 
     GROUP BY status`,
    [teamId]
  )

  const stats = {
    total: 0,
    completed: 0,
    failed: 0,
    inProgress: 0,
    blocked: 0,
  }

  for (const row of result.rows) {
    stats.total += row.count
    if (row.status === 'completed') stats.completed += row.count
    if (row.status === 'failed') stats.failed += row.count
    if (row.status === 'in_progress') stats.inProgress += row.count
    if (row.status === 'blocked') stats.blocked += row.count
  }

  return stats
}

/**
 * Clear old workflow history (cleanup)
 */
export async function cleanupOldWorkflows(ageHours: number = 168): Promise<number> {
  const result = await query(
    `DELETE FROM coordination_workflow_history 
     WHERE created_at < NOW() - INTERVAL '${ageHours} hours'
     RETURNING id`
  )

  return result.rows.length
}

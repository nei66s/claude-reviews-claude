/**
 * Error Handling & Retry System for Coordination Workers
 * Manages worker failures, retries, and escalation
 */

import { query } from '../db.js'
import type { QueryResultRow } from 'pg'

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical'
export type ErrorCategory = 'permission_denied' | 'timeout' | 'invalid_state' | 'resource_error' | 'unknown'
export type RetryStrategy = 'exponential_backoff' | 'linear' | 'no_retry'

export interface WorkerError extends QueryResultRow {
  id: string
  team_id: string
  worker_agent_id: string
  workflow_id: string | null
  error_message: string
  error_category: ErrorCategory
  severity: ErrorSeverity
  retry_count: number
  max_retries: number
  retry_strategy: RetryStrategy
  next_retry_at: string | null
  stack_trace: string | null
  context: Record<string, unknown> | null
  created_at: string
  updated_at: string
}

/**
 * Initialize error tracking tables
 */
export async function initErrorHandlingTables() {
  await query(`
    CREATE TABLE IF NOT EXISTS worker_errors (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      worker_agent_id TEXT NOT NULL,
      workflow_id TEXT,
      error_message TEXT NOT NULL,
      error_category TEXT NOT NULL CHECK (error_category IN (
        'permission_denied', 'timeout', 'invalid_state', 'resource_error', 'unknown'
      )) DEFAULT 'unknown',
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
      retry_count INT NOT NULL DEFAULT 0,
      max_retries INT NOT NULL DEFAULT 3,
      retry_strategy TEXT NOT NULL DEFAULT 'exponential_backoff',
      next_retry_at TIMESTAMPTZ,
      stack_trace TEXT,
      context JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_worker_errors_team ON worker_errors(team_id);
    CREATE INDEX IF NOT EXISTS idx_worker_errors_worker ON worker_errors(worker_agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_worker_errors_retry ON worker_errors(next_retry_at) WHERE next_retry_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_worker_errors_severity ON worker_errors(severity, created_at DESC);
  `)
}

/**
 * Log a worker error
 */
export async function logWorkerError(
  teamId: string,
  workerAgentId: string,
  errorMessage: string,
  options?: {
    category?: ErrorCategory
    severity?: ErrorSeverity
    maxRetries?: number
    retryStrategy?: RetryStrategy
    stackTrace?: string
    workflowId?: string
    context?: Record<string, unknown>
  }
): Promise<string> {
  const errorId = `error-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
  const category = options?.category || 'unknown'
  const severity = options?.severity || 'medium'
  const maxRetries = options?.maxRetries ?? 3
  const retryStrategy = options?.retryStrategy || 'exponential_backoff'

  await query(
    `INSERT INTO worker_errors 
     (id, team_id, worker_agent_id, workflow_id, error_message, error_category, severity, max_retries, retry_strategy, stack_trace, context)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
    [
      errorId,
      teamId,
      workerAgentId,
      options?.workflowId || null,
      errorMessage,
      category,
      severity,
      maxRetries,
      retryStrategy,
      options?.stackTrace || null,
      JSON.stringify(options?.context || {}),
    ]
  )

  return errorId
}

/**
 * Schedule retry for failed worker
 */
export async function scheduleRetry(
  errorId: string,
  delaySeconds: number = 60
): Promise<void> {
  const nextRetryAt = new Date(Date.now() + delaySeconds * 1000).toISOString()

  await query(
    `UPDATE worker_errors 
     SET retry_count = retry_count + 1, 
         next_retry_at = $1,
         updated_at = NOW()
     WHERE id = $2`,
    [nextRetryAt, errorId]
  )
}

/**
 * Calculate exponential backoff delay
 * Formula: min(maxDelay, baseDelay * 2^retryCount)
 */
export function calculateBackoffDelay(
  retryCount: number,
  baseDelay: number = 10,
  maxDelay: number = 300
): number {
  return Math.min(maxDelay, baseDelay * Math.pow(2, retryCount))
}

/**
 * Calculate linear backoff delay
 * Formula: min(maxDelay, baseDelay * (retryCount + 1))
 */
export function calculateLinearBackoff(
  retryCount: number,
  baseDelay: number = 30,
  maxDelay: number = 300
): number {
  return Math.min(maxDelay, baseDelay * (retryCount + 1))
}

/**
 * Get errors pending retry
 */
export async function getPendingRetries(): Promise<WorkerError[]> {
  const result = await query<WorkerError>(
    `SELECT * FROM worker_errors 
     WHERE next_retry_at IS NOT NULL 
       AND next_retry_at <= NOW()
       AND retry_count < max_retries
     ORDER BY next_retry_at ASC`,
    []
  )

  return result.rows
}

/**
 * Check if error should retry
 */
export async function shouldRetry(errorId: string): Promise<boolean> {
  const result = await query<{ retry_count: number; max_retries: number }>(
    `SELECT retry_count, max_retries FROM worker_errors WHERE id = $1`,
    [errorId]
  )

  if (result.rows.length === 0) return false

  const error = result.rows[0]
  return error.retry_count < error.max_retries
}

/**
 * Mark error as resolved
 */
export async function resolveError(errorId: string): Promise<void> {
  await query(
    `UPDATE worker_errors 
     SET next_retry_at = NULL, updated_at = NOW()
     WHERE id = $1`,
    [errorId]
  )
}

/**
 * Get error statistics for team
 */
export async function getTeamErrorStats(teamId: string): Promise<{
  total: number
  byCategory: Record<ErrorCategory, number>
  bySeverity: Record<ErrorSeverity, number>
  pendingRetries: number
}> {
  const categoryResult = await query<{ error_category: string; count: number }>(
    `SELECT error_category, COUNT(*) as count FROM worker_errors 
     WHERE team_id = $1 
     GROUP BY error_category`,
    [teamId]
  )

  const severityResult = await query<{ severity: string; count: number }>(
    `SELECT severity, COUNT(*) as count FROM worker_errors 
     WHERE team_id = $1 
     GROUP BY severity`,
    [teamId]
  )

  const totalResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM worker_errors WHERE team_id = $1`,
    [teamId]
  )

  const retryResult = await query<{ count: number }>(
    `SELECT COUNT(*) as count FROM worker_errors 
     WHERE team_id = $1 AND next_retry_at IS NOT NULL AND next_retry_at <= NOW()`,
    [teamId]
  )

  const byCategory: Record<string, number> = {}
  const bySeverity: Record<string, number> = {}

  for (const row of categoryResult.rows) {
    byCategory[row.error_category] = row.count
  }

  for (const row of severityResult.rows) {
    bySeverity[row.severity] = row.count
  }

  return {
    total: totalResult.rows[0]?.count || 0,
    byCategory: byCategory as Record<ErrorCategory, number>,
    bySeverity: bySeverity as Record<ErrorSeverity, number>,
    pendingRetries: retryResult.rows[0]?.count || 0,
  }
}

/**
 * Get detailed error info
 */
export async function getError(errorId: string): Promise<WorkerError | null> {
  const result = await query<WorkerError>(`SELECT * FROM worker_errors WHERE id = $1`, [errorId])

  return result.rows[0] || null
}

/**
 * Get recent errors
 */
export async function getRecentErrors(teamId: string, limit: number = 20): Promise<WorkerError[]> {
  const result = await query<WorkerError>(
    `SELECT * FROM worker_errors 
     WHERE team_id = $1 
     ORDER BY created_at DESC 
     LIMIT $2`,
    [teamId, limit]
  )

  return result.rows
}

/**
 * Get errors eligible for escalation (high retry count)
 */
export async function getErrorsEligibleForEscalation(thresholdRetries: number = 3): Promise<WorkerError[]> {
  const result = await query<WorkerError>(
    `SELECT * FROM worker_errors 
     WHERE retry_count >= $1 
     AND severity != 'critical'
     AND updated_at < NOW() - INTERVAL '1 minute'
     ORDER BY severity DESC, retry_count DESC`,
    [thresholdRetries]
  )

  return result.rows
}

/**
 * Escalate error (promote severity)
 */
export async function escalateError(errorId: string): Promise<void> {
  const severities: ErrorSeverity[] = ['low', 'medium', 'high', 'critical']

  const result = await query<{ severity: string }>(
    `SELECT severity FROM worker_errors WHERE id = $1`,
    [errorId]
  )

  if (result.rows.length === 0) return

  const currentSeverity = result.rows[0].severity as ErrorSeverity
  const currentIndex = severities.indexOf(currentSeverity)
  const nextSeverity = currentIndex < severities.length - 1 ? severities[currentIndex + 1] : 'critical'

  await query(
    `UPDATE worker_errors SET severity = $1, updated_at = NOW() WHERE id = $2`,
    [nextSeverity, errorId]
  )
}

/**
 * Cleanup old errors
 */
export async function cleanupOldErrors(ageHours: number = 168): Promise<number> {
  const result = await query(
    `DELETE FROM worker_errors 
     WHERE created_at < NOW() - INTERVAL '${ageHours} hours'
     AND next_retry_at IS NULL
     RETURNING id`
  )

  return result.rows.length
}

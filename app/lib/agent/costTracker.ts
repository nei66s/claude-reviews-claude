/**
 * Cost Tracker — Tracks OpenAI API costs with detailed breakdown
 * 
 * Responsibilities:
 * - Track costs per model, user, and conversation
 * - Provide cost summaries and alerts
 * - Help with usage analytics and billing
 */

import { query, withTransaction } from './db'
import type pg from 'pg'

export type CostRecord = {
  userId: string
  chatId: string
  model: string
  inputTokens: number
  outputTokens: number
  totalCost: number
  createdAt: Date
}

export type CostBreakdown = {
  userId: string
  totalCost: number
  byChatId: Record<string, number>
  byModel: Record<string, number>
  thisHour: number
  today: number
  thisMonth: number
}

// Pricing (as of April 2025 - gpt-5)
const PRICING = {
  'gpt-5': {
    input: 0.0075, // $ per 1K input tokens
    output: 0.030, // $ per 1K output tokens
  },
  'gpt-4-turbo': {
    input: 0.001,
    output: 0.003,
  },
  'gpt-4': {
    input: 0.00003,
    output: 0.00006,
  },
  'gpt-3.5-turbo': {
    input: 0.0005,
    output: 0.0015,
  },
} as Record<string, { input: number; output: number }>

export async function initCostTracker() {
  await query(`
    CREATE TABLE IF NOT EXISTS cost_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INT NOT NULL,
      output_tokens INT NOT NULL,
      total_cost DECIMAL(10, 6) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cost_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      monthly_budget_cents INT NOT NULL DEFAULT 10000,
      spent_this_month DECIMAL(10, 6) NOT NULL DEFAULT 0,
      last_reset_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, chat_id),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_cost_logs_user_chat 
      ON cost_logs (user_id, chat_id, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_cost_logs_model 
      ON cost_logs (model, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_cost_logs_hour
      ON cost_logs (created_at DESC);
  `)
}

/**
 * Calculate USD cost from token counts
 */
export function calculateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
): number {
  const pricing = PRICING[model] || PRICING['gpt-4']
  const inputCost = (inputTokens / 1000) * pricing.input
  const outputCost = (outputTokens / 1000) * pricing.output
  return inputCost + outputCost
}

/**
 * Record API usage after OpenAI call completes
 */
export async function recordCost(record: Omit<CostRecord, 'createdAt'>) {
  return withTransaction(async (client) => {
    const budgetId = `${record.userId}#${record.chatId}`
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

    // Get or create budget
    let budgetResult = await client.query(
      `SELECT * FROM cost_budgets WHERE id = $1 FOR UPDATE`,
      [budgetId],
    )

    if (budgetResult.rows.length === 0) {
      await client.query(
        `INSERT INTO cost_budgets (id, user_id, chat_id, last_reset_month, created_at, updated_at)
         VALUES ($1, $2, $3, $4, NOW(), NOW())`,
        [budgetId, record.userId, record.chatId, monthStart],
      )
    }

    // Log cost
    await client.query(
      `INSERT INTO cost_logs (user_id, chat_id, model, input_tokens, output_tokens, total_cost, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [record.userId, record.chatId, record.model, record.inputTokens, record.outputTokens, record.totalCost],
    )

    // Update budget spent this month
    await client.query(
      `UPDATE cost_budgets 
       SET spent_this_month = spent_this_month + $2,
           updated_at = NOW()
       WHERE id = $1`,
      [budgetId, record.totalCost],
    )
  })
}

/**
 * Get cost breakdown for a user
 */
export async function getCostBreakdown(userId: string): Promise<CostBreakdown> {
  const now = new Date()
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000)
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)

  const [totalResult, hourResult, dayResult, monthResult, byChatResult, byModelResult] = await Promise.all([
    query(
      `SELECT COALESCE(SUM(total_cost), 0) as total FROM cost_logs WHERE user_id = $1`,
      [userId],
    ),
    query(
      `SELECT COALESCE(SUM(total_cost), 0) as total FROM cost_logs WHERE user_id = $1 AND created_at > $2`,
      [userId, hourAgo],
    ),
    query(
      `SELECT COALESCE(SUM(total_cost), 0) as total FROM cost_logs WHERE user_id = $1 AND created_at > $2`,
      [userId, dayAgo],
    ),
    query(
      `SELECT COALESCE(SUM(total_cost), 0) as total FROM cost_logs WHERE user_id = $1 AND created_at >= $2`,
      [userId, monthStart],
    ),
    query(
      `SELECT chat_id, SUM(total_cost) as total FROM cost_logs WHERE user_id = $1 GROUP BY chat_id`,
      [userId],
    ),
    query(
      `SELECT model, SUM(total_cost) as total FROM cost_logs WHERE user_id = $1 GROUP BY model`,
      [userId],
    ),
  ])

  const byChatId: Record<string, number> = {}
  for (const row of byChatResult.rows) {
    byChatId[row.chat_id] = parseFloat(row.total)
  }

  const byModel: Record<string, number> = {}
  for (const row of byModelResult.rows) {
    byModel[row.model] = parseFloat(row.total)
  }

  return {
    userId,
    totalCost: parseFloat(totalResult.rows[0]?.total || 0),
    byChatId,
    byModel,
    thisHour: parseFloat(hourResult.rows[0]?.total || 0),
    today: parseFloat(dayResult.rows[0]?.total || 0),
    thisMonth: parseFloat(monthResult.rows[0]?.total || 0),
  }
}

/**
 * Check if monthly budget exceeded
 */
export async function isMonthlyBudgetExceeded(userId: string, chatId: string): Promise<boolean> {
  const budgetId = `${userId}#${chatId}`
  const result = await query(
    `SELECT spent_this_month, monthly_budget_cents FROM cost_budgets WHERE id = $1`,
    [budgetId],
  )

  if (result.rows.length === 0) {
    return false
  }

  const spent = parseFloat(result.rows[0].spent_this_month)
  const budget = result.rows[0].monthly_budget_cents / 100

  return spent >= budget
}

/**
 * Cleanup old cost logs (keep last 12 months)
 */
export async function cleanupOldLogs() {
  await query(
    `DELETE FROM cost_logs 
     WHERE created_at < NOW() - INTERVAL '12 months'`,
  )
}

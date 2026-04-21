/**
 * Token Manager — Tracks token usage and enforces budgets
 *
 * Responsibilities:
 * - Estimate tokens for text (with fallback to char count)
 * - Track per-conversation and per-user token budgets
 * - Enforce rate limits and daily caps
 * - Provide warnings when approaching limits
 */
import { query, withTransaction } from './db.js';
import { circuitBreakerManager } from './instincts/circuit-breaker.js';
const TOKENS_PER_HOUR_PER_USER = 100_000;
const TOKENS_PER_DAY_PER_USER = 500_000;
const TOKENS_PER_MONTH_PER_USER = 5_000_000;
const TOKENS_PER_MESSAGE_MIN = 10;
const TOKENS_PER_MESSAGE_MAX = 2000;
const CHAR_TO_TOKEN_RATIO = 0.25; // Rough estimate: 1 token ≈ 4 chars
/**
 * Rough token estimation using character count (for fast estimation).
 * For exact counts, integrate with OpenAI's tokenizer library.
 */
export function estimateTokens(text) {
    if (!text)
        return 0;
    const estimated = Math.ceil(text.length * CHAR_TO_TOKEN_RATIO);
    return Math.max(TOKENS_PER_MESSAGE_MIN, Math.min(estimated, TOKENS_PER_MESSAGE_MAX));
}
/**
 * Initialize token manager tables on startup
 */
export async function initTokenManager() {
    await query(`
    CREATE TABLE IF NOT EXISTS token_usage (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      tokens_used INT NOT NULL DEFAULT 0,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      tokens_used_today INT NOT NULL DEFAULT 0,
      tokens_used_this_month INT NOT NULL DEFAULT 0,
      tokens_used_this_hour INT NOT NULL DEFAULT 0,
      last_reset_hour INT NOT NULL,
      last_reset_day DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, chat_id),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_token_usage_user_chat 
      ON token_usage (user_id, chat_id, used_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_token_usage_hour 
      ON token_usage (used_at DESC);

    CREATE INDEX IF NOT EXISTS idx_token_budgets_user 
      ON token_budgets (user_id, updated_at DESC);
  `);
}
/**
 * Get or create budget record for conversation
 */
export async function getBudget(userId, chatId) {
    return withTransaction(async (client) => {
        // Get or create budget
        const id = `${userId}#${chatId}`;
        const now = new Date();
        const hour = now.getHours();
        const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const result = await client.query(`SELECT * FROM token_budgets WHERE id = $1 FOR UPDATE`, [id]);
        if (result.rows.length === 0) {
            await client.query(`INSERT INTO token_budgets (id, user_id, chat_id, last_reset_hour, last_reset_day, updated_at, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW(), NOW())`, [id, userId, chatId, hour, day]);
            return {
                userId,
                chatId,
                tokensUsedToday: 0,
                tokensUsedThisMonth: 0,
                tokensUsedThisHour: 0,
                lastResetHour: hour,
                lastResetDay: day,
            };
        }
        const row = result.rows[0];
        // Check if we need to reset hourly/daily counters
        const needsHourReset = row.last_reset_hour !== hour;
        const needsDayReset = new Date(row.last_reset_day).getTime() !== day.getTime();
        if (needsHourReset || needsDayReset) {
            await client.query(`UPDATE token_budgets 
         SET ${needsHourReset ? 'tokens_used_this_hour = 0,' : ''}
             ${needsDayReset ? 'tokens_used_today = 0,' : ''}
             last_reset_hour = $2,
             last_reset_day = $3,
             updated_at = NOW()
         WHERE id = $1`, [id, hour, day]);
            return {
                userId,
                chatId,
                tokensUsedToday: needsDayReset ? 0 : row.tokens_used_today,
                tokensUsedThisMonth: row.tokens_used_this_month,
                tokensUsedThisHour: needsHourReset ? 0 : row.tokens_used_this_hour,
                lastResetHour: hour,
                lastResetDay: day,
            };
        }
        return {
            userId,
            chatId,
            tokensUsedToday: row.tokens_used_today,
            tokensUsedThisMonth: row.tokens_used_this_month,
            tokensUsedThisHour: row.tokens_used_this_hour,
            lastResetHour: row.last_reset_hour,
            lastResetDay: new Date(row.last_reset_day),
        };
    });
}
/**
 * Record token usage
 */
export async function recordUsage(userId, chatId, tokens) {
    return withTransaction(async (client) => {
        const id = `${userId}#${chatId}`;
        // Get current budget
        const budgetResult = await client.query(`SELECT * FROM token_budgets WHERE id = $1 FOR UPDATE`, [id]);
        if (budgetResult.rows.length === 0) {
            throw new Error(`Budget not found for ${id}`);
        }
        const row = budgetResult.rows[0];
        const newHourly = row.tokens_used_this_hour + tokens;
        const newDaily = row.tokens_used_today + tokens;
        const newMonthly = row.tokens_used_this_month + tokens;
        // ⚙️ Check circuit breaker on token limits
        if (newDaily > TOKENS_PER_DAY_PER_USER * 0.95) {
            circuitBreakerManager.recordFailure('token_limit');
            console.warn(`⚠️ Daily token limit 95% reached for ${userId}`);
        }
        else {
            circuitBreakerManager.recordSuccess('token_limit');
        }
        // Update budget
        await client.query(`UPDATE token_budgets 
       SET tokens_used_this_hour = $2,
           tokens_used_today = $3,
           tokens_used_this_month = $4,
           updated_at = NOW()
       WHERE id = $1`, [id, newHourly, newDaily, newMonthly]);
        // Log usage
        await client.query(`INSERT INTO token_usage (user_id, chat_id, tokens_used, used_at)
       VALUES ($1, $2, $3, NOW())`, [userId, chatId, tokens]);
        return { newHourly, newDaily, newMonthly };
    });
}
/**
 * Get token usage statistics for a user/chat
 */
export async function getStats(userId, chatId) {
    const budget = await getBudget(userId, chatId);
    const availableToday = TOKENS_PER_DAY_PER_USER - budget.tokensUsedToday;
    const availableThisHour = TOKENS_PER_HOUR_PER_USER - budget.tokensUsedThisHour;
    const remaining = Math.min(availableToday, availableThisHour);
    const totalUsed = budget.tokensUsedToday + budget.tokensUsedThisHour;
    return {
        used: totalUsed,
        available: Math.max(0, remaining),
        percentageUsed: Math.round((totalUsed / (TOKENS_PER_DAY_PER_USER + TOKENS_PER_HOUR_PER_USER)) * 100),
        isWarning: remaining < TOKENS_PER_DAY_PER_USER * 0.2, // Warning at 80%
        isBlocked: remaining <= 0,
    };
}
/**
 * Check if user is within limits
 */
export async function isWithinLimits(userId, chatId, estimatedTokens) {
    const stats = await getStats(userId, chatId);
    return stats.available >= estimatedTokens;
}
/**
 * Cleanup old token logs (keep last 90 days)
 */
export async function cleanupOldLogs() {
    await query(`DELETE FROM token_usage 
     WHERE used_at < NOW() - INTERVAL '90 days'`);
}

/**
 * Instinct Engine — Orchestrator for all reflex systems
 * 
 * Decides what gets processed by reflexes vs LLM thinking:
 * - Dangerous requests → block via reflexes
 * - Common requests → use cache
 * - Context-specific rules → apply social protocols
 * - Otherwise → send to LLM
 */

import { checkReflexes } from './reflexes'
import { cacheHandler } from './cache-handler'
import { circuitBreakerManager } from './circuit-breaker'
import { habitManager } from './habit-patterns'
import { socialProtocolManager, type UserRole } from './social-protocols'
import type { ToolContext } from '../tools'

export type InstinctResponse = {
  type: 'blocked' | 'cached' | 'protocol' | 'habit' | 'thoughtful'
  confidence: number
  action?: string
  reason: string
  skipLLM: boolean
}

export type InstinctContext = {
  input: string
  tokenCount?: number
  tokenLimit?: number
  userRole?: UserRole
  action?: string
  context?: any
}

export class InstinctEngine {
  /**
   * Process request through instinct layers
   * Returns instinct decision OR null to send to LLM
   */
  async process(ctx: InstinctContext): Promise<InstinctResponse | null> {
    // Layer 1: DANGER REFLEXES (Espinal) — Block immediately
    const reflexResponse = checkReflexes(ctx.input, ctx.tokenCount, ctx.tokenLimit)
    if (reflexResponse.blocked) {
      return {
        type: 'blocked',
        confidence: 1.0,
        reason: reflexResponse.reason || 'Blocked by safety reflex',
        skipLLM: true,
      }
    }

    // Layer 2: CIRCUIT BREAKERS — If any are open, protect
    if (circuitBreakerManager.isOpen('cost_limit')) {
      return {
        type: 'blocked',
        confidence: 0.95,
        reason: 'Cost limit circuit breaker OPEN - rate limiting',
        skipLLM: true,
      }
    }

    if (circuitBreakerManager.isOpen('token_limit')) {
      return {
        type: 'blocked',
        confidence: 0.9,
        reason: 'Token limit circuit breaker open - compress or wait',
        skipLLM: true,
      }
    }

    // Layer 3: CACHE (Tálamo) — Check muscle memory
    const cacheHit = cacheHandler.lookup(ctx.input)
    if (cacheHit.found && cacheHit.confidence! > 0.88) {
      circuitBreakerManager.recordSuccess('cache_hit_reduces_latency')
      return {
        type: 'cached',
        confidence: cacheHit.confidence!,
        action: cacheHit.response,
        reason: `Cache hit (${(cacheHit.confidence! * 100).toFixed(1)}% similar)`,
        skipLLM: true,
      }
    }

    // Layer 4: SOCIAL PROTOCOLS (Social) — Context-based auto-approval
    if (ctx.userRole && ctx.action) {
      const protocol = socialProtocolManager.applyProtocols(ctx.userRole, ctx.action, ctx.context)

      if (protocol === 'auto_allow') {
        return {
          type: 'protocol',
          confidence: 0.85,
          action: `Allowed by ${ctx.userRole} protocol`,
          reason: `${ctx.userRole} role has protocol for '${ctx.action}'`,
          skipLLM: false, // Still needs thought for execution
        }
      }

      if (protocol === 'auto_deny') {
        return {
          type: 'protocol',
          confidence: 0.95,
          reason: `${ctx.userRole} role denied for '${ctx.action}' - requires approval`,
          skipLLM: true,
        }
      }
    }

    // Layer 5: HABIT PATTERNS (Emocional) — Learned behaviors
    const triggers = this.extractTriggers(ctx)
    const recommendations = habitManager.getRecommendations(triggers)

    if (recommendations.length > 0) {
      const topHabit = recommendations[0]
      if (topHabit.successRate > 0.85) {
        return {
          type: 'habit',
          confidence: topHabit.successRate,
          action: topHabit.action,
          reason: `Habit learned: "${topHabit.trigger}" → "${topHabit.action}" (${(topHabit.successRate * 100).toFixed(0)}% success)`,
          skipLLM: false,
        }
      }
    }

    // No instinct matched → send to thoughtful LLM processing
    return null
  }

  /**
   * Extract contextual triggers for habit matching
   */
  private extractTriggers(ctx: InstinctContext): string[] {
    const triggers: string[] = []

    if (ctx.tokenCount && ctx.tokenLimit && ctx.tokenCount > ctx.tokenLimit * 0.8) {
      triggers.push('approaching token limit')
    }

    if (ctx.action) {
      triggers.push(ctx.action)
    }

    if (ctx.userRole) {
      triggers.push(`${ctx.userRole} user`)
    }

    return triggers
  }

  /**
   * Record outcome to improve future instinct decisions
   */
  recordOutcome(habitId: string, success: boolean): void {
    if (success) {
      habitManager.recordSuccess(habitId)
    } else {
      habitManager.recordFailure(habitId)
    }
  }

  /**
   * Get current instinct status/health
   */
  getStatus(): any {
    return {
      cache: cacheHandler.getStats(),
      circuitBreakers: circuitBreakerManager.getStatus(),
      habits: habitManager.getSummary(),
    }
  }

  /**
   * Reset all instincts (rarely needed, e.g., attack detected)
   */
  reset(): void {
    cacheHandler.clear()
    habitManager.reset()
    // Don't reset circuit breakers on full reset - they're needed for safety
  }
}

export const instinctEngine = new InstinctEngine()

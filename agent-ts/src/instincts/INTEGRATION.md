/**
 * Integration Guide: How to use Instincts in your AI body
 * 
 * The Instinct System adds 4 layers of automatic behavior before LLM thinks.
 * This dramatically improves latency, reduces costs, and makes the AI more responsive.
 */

import { instinctEngine, type InstinctContext } from './instinct-engine.js'
import { cacheHandler } from './cache-handler.js'
import { habitManager } from './habit-patterns.js'

/**
 * PATTERN 1: Check instincts before calling LLM
 * 
 * Place this at the start of your query handler:
 */
export async function queryWithInstincts(
  input: string,
  tokenCount: number,
  tokenLimit: number,
  userRole: string,
) {
  // 1. Run through instinct layers (< 10ms typically)
  const instinctResponse = await instinctEngine.process({
    input,
    tokenCount,
    tokenLimit,
    userRole: userRole as any,
  })

  if (instinctResponse) {
    console.log(`⚡ Instinct triggered: ${instinctResponse.type}`)
    console.log(`   Reason: ${instinctResponse.reason}`)

    // Instinct handled it!
    return {
      source: 'instinct',
      type: instinctResponse.type,
      response: instinctResponse.action || instinctResponse.reason,
      confidence: instinctResponse.confidence,
    }
  }

  // 2. No instinct matched, send to LLM (normal flow)
  console.log('💭 Sending to LLM for thoughtful analysis...')
  const llmResponse = await callLLMThoughtfully(input)

  // 3. Cache the result for future instincts
  cacheHandler.store(input, llmResponse, 0.95)

  return {
    source: 'llm',
    response: llmResponse,
    confidence: 1.0,
  }
}

/**
 * PATTERN 2: Use habits to optimize behavior
 * 
 * Instead of always thinking, check what worked before:
 */
export async function smartDecision(situation: string, options: string[]) {
  // What worked in similar situations?
  const recommendations = habitManager.getRecommendations([situation])

  if (recommendations.length > 0) {
    const bestHabit = recommendations[0]
    console.log(`🧠 Habit suggests: ${bestHabit.action} (${(bestHabit.successRate * 100).toFixed(0)}% success)`)
    return bestHabit.action
  }

  // Nothing learned yet, ask LLM
  console.log('💭 No habit learned, asking LLM...')
  const decision = await askLLMForDecision(situation, options)

  // Learn from this decision
  habitManager.registerHabit(
    `learned_${Date.now()}`,
    situation,
    decision,
    'neutral',
  )

  return decision
}

/**
 * PATTERN 3: Monitor instinct health
 * 
 * Call periodically to see how well instincts are working:
 */
export function monitorInstinctHealth() {
  const status = instinctEngine.getStatus()
  const cacheStats = status.cache
  const circuitStatus = status.circuitBreakers
  const habitSummary = status.habits

  console.log(`
📊 INSTINCT HEALTH REPORT:

🔲 CACHE PERFORMANCE:
  - Size: ${cacheStats.size} entries
  - Avg hits per entry: ${cacheStats.avgHits.toFixed(1)}
  - Top patterns: ${cacheStats.topHits.join(', ')}

⚙️ CIRCUIT BREAKERS:
  ${Object.entries(circuitStatus)
    .map(([id, { state }]) => `  - ${id}: ${state}`)
    .join('\n')}

🧠 HABIT LEARNING:
  - Total habits: ${habitSummary.totalHabits}
  - Reliable (>70% success): ${habitSummary.reliableHabits}
  - Needs practice: ${habitSummary.practiceNeeded}
`)
}

/**
 * PATTERN 4: Safe mode - disable or restrict instincts
 * 
 * Use when you detect something wrong:
 */
export async function safeMode() {
  console.log('🔒 SAFE MODE: Disabling instincts, routing everything through LLM')
  instinctEngine.reset()
  // All requests now bypass cache/habits and go straight to LLM
}

/**
 * PATTERN 5: Analysis - see what types of requests instincts handle
 * 
 * Call after running for a while:
 */
export function analyzeInstinctPatterns() {
  const habits = habitManager.getAllHabits()

  const byCategory = habits.reduce(
    (acc, h) => {
      if (!acc[h.category]) acc[h.category] = []
      acc[h.category].push(h)
      return acc
    },
    {} as Record<string, any[]>,
  )

  console.log(`
📈 INSTINCT PATTERNS LEARNED:

✅ Successes (${byCategory.success?.length || 0}):
${(byCategory.success || [])
  .map(h => `  - "${h.trigger}" → "${h.action}" (${(h.successRate * 100).toFixed(0)}%)`)
  .join('\n')}

❌ Failures (${byCategory.failure?.length || 0}):
${(byCategory.failure || [])
  .map(h => `  - "${h.trigger}" → "${h.action}" (${(h.successRate * 100).toFixed(0)}%)`)
  .join('\n')}

🟡 Neutral (${byCategory.neutral?.length || 0}):
${(byCategory.neutral || [])
  .map(h => `  - "${h.trigger}" → "${h.action}"`)
  .join('\n')}
`)
}

// ============================================================================

async function callLLMThoughtfully(_input: string): Promise<string> {
  // This would call your actual LLM (OpenAI, Claude, etc)
  return 'LLM response here'
}

async function askLLMForDecision(_situation: string, _options: string[]): Promise<string> {
  return 'LLM decision here'
}

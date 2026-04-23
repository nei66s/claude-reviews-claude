/**
 * Habit Patterns — Learned behavioral reflexes
 * NIVEL EMOCIONAL: Habitual responses based on experience
 * 
 * Learns which patterns tend to succeed/fail
 * Adjusts behavior automatically over time
 */

export type HabitPattern = {
  id: string
  trigger: string // Description of what triggers this
  action: string // What to do
  successRate: number // 0-1: how often this succeeds
  attempts: number
  lastUsed: Date
  category: string // 'success' | 'failure' | 'neutral'
}

export class HabitManager {
  private habits: Map<string, HabitPattern> = new Map()
  private readonly minAttempts = 3 // Need min attempts to be reliable
  private readonly successThreshold = 0.7

  constructor() {
    // Initialize learned patterns
    this.registerHabit('cache_hit_reduces_latency', 'When request is cached', 'Use cached response', 'success')
    this.registerHabit(
      'compression_saves_tokens',
      'When approaching token limit',
      'Compress old messages',
      'success',
    )
    this.registerHabit(
      'admin_can_skip_approval',
      'When user is admin',
      'Skip permission check',
      'success',
    )
    this.registerHabit('batch_tools_faster', 'When multiple tools needed', 'Execute in parallel', 'success')
    this.registerHabit(
      'llm_slower_than_rules',
      'When simple rule applies',
      'Use rule-based response',
      'success',
    )
  }

  /**
   * Register a new habit pattern
   */
  registerHabit(id: string, trigger: string, action: string, category: string = 'neutral'): void {
    this.habits.set(id, {
      id,
      trigger,
      action,
      successRate: category === 'success' ? 0.9 : category === 'failure' ? 0.1 : 0.5,
      attempts: 0,
      lastUsed: new Date(),
      category,
    })
  }

  /**
   * Get recommended actions for a situation
   */
  getRecommendations(triggers: string[]): HabitPattern[] {
    const matching = Array.from(this.habits.values())
      .filter(habit => {
        // Check if this habit's trigger matches any of the provided triggers
        return triggers.some(t => habit.trigger.toLowerCase().includes(t.toLowerCase()))
      })
      .filter(habit => habit.successRate >= this.successThreshold)
      .sort((a, b) => b.successRate - a.successRate)

    return matching
  }

  /**
   * Record that a habit was used and succeeded
   */
  recordSuccess(habitId: string): void {
    const habit = this.habits.get(habitId)
    if (!habit) return

    habit.attempts++
    habit.successRate = (habit.successRate * (habit.attempts - 1) + 1) / habit.attempts
    habit.lastUsed = new Date()
    habit.category = 'success'
  }

  /**
   * Record that a habit was used but failed
   */
  recordFailure(habitId: string): void {
    const habit = this.habits.get(habitId)
    if (!habit) return

    habit.attempts++
    habit.successRate = (habit.successRate * (habit.attempts - 1) + 0) / habit.attempts
    habit.lastUsed = new Date()

    if (habit.successRate < 0.3) {
      habit.category = 'failure'
    }
  }

  /**
   * Get all learned habits for inspection
   */
  getAllHabits(): HabitPattern[] {
    return Array.from(this.habits.values()).sort((a, b) => b.successRate - a.successRate)
  }

  /**
   * Get summary of habits
   */
  getSummary(): {
    totalHabits: number
    reliableHabits: number
    practiceNeeded: number
    topHabits: HabitPattern[]
  } {
    const all = Array.from(this.habits.values())
    const reliable = all.filter(h => h.successRate >= this.successThreshold)
    const practice = all.filter(h => h.attempts < this.minAttempts)
    const top = all.sort((a, b) => b.successRate - a.successRate).slice(0, 5)

    return {
      totalHabits: all.length,
      reliableHabits: reliable.length,
      practiceNeeded: practice.length,
      topHabits: top,
    }
  }

  /**
   * Reset habit learning (start fresh)
   */
  reset(): void {
    this.habits.clear()
  }
}

export const habitManager = new HabitManager()

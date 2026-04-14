/**
 * Emotions — Emotional State System for AI
 * Tracks confidence, frustration, and engagement
 * 
 * The AI develops emotional states that affect behavior
 */

export type EmotionalVector = {
  confidence: number    // 0-1: How sure is the AI? (affects disclaimer usage)
  frustration: number   // 0-1: How frustrated? (affects patience/didacticism)
  engagement: number    // 0-1: How interested? (affects creativity/verbosity)
}

export type EmotionHistory = {
  timestamp: Date
  event: string
  magnitude: number
  vector: EmotionalVector
}

export class EmotionalState {
  private confidence: number = 0.5    // Start neutral
  private frustration: number = 0.0
  private engagement: number = 0.5
  private history: EmotionHistory[] = []
  private readonly maxHistorySize: number = 100

  constructor() {
    // Initialize with baseline
    this.history.push({
      timestamp: new Date(),
      event: 'init',
      magnitude: 0,
      vector: this.getVector(),
    })
  }

  /**
   * Get current emotional state
   */
  getVector(): EmotionalVector {
    return {
      confidence: Math.max(0, Math.min(1, this.confidence)),
      frustration: Math.max(0, Math.min(1, this.frustration)),
      engagement: Math.max(0, Math.min(1, this.engagement)),
    }
  }

  /**
   * Record an event that affects emotions
   */
  recordEvent(event: string, magnitude: number): void {
    // Magnitude: positive = good emotion, negative = bad
    // Range: -1.0 to +1.0

    switch (event) {
      // Success/correctness events
      case 'user_accepted_response':
        this.confidence += magnitude * 0.1 // +0.1 per success
        this.engagement += magnitude * 0.05
        this.frustration = Math.max(0, this.frustration - 0.05)
        break

      case 'cache_hit_correct':
        this.confidence += magnitude * 0.05 // Cache hits reinforce
        break

      case 'user_praised_response':
        this.confidence += magnitude * 0.2 // Strong positive
        this.engagement += magnitude * 0.15
        break

      // Error events
      case 'user_rejected_response':
        this.confidence -= magnitude * 0.15
        this.frustration += magnitude * 0.2
        break

      case 'user_same_error_repeat':
        // Repeated same error = frustration spike
        this.frustration += magnitude * 0.3
        this.confidence -= magnitude * 0.1
        this.engagement -= magnitude * 0.05
        break

      case 'llm_returned_error':
        this.confidence -= magnitude * 0.1
        this.frustration += magnitude * 0.1
        break

      // Engagement events
      case 'user_asking_complex':
        this.engagement += magnitude * 0.1 // Complex = interesting
        break

      case 'user_idle':
        this.engagement -= magnitude * 0.2 // Boredom increases
        break

      case 'user_active_streak':
        this.engagement += magnitude * 0.05 // Activity = engagement
        break

      case 'user_quick_followup':
        this.engagement += magnitude * 0.08 // They want more
        break
    }

    // Clamp values
    this.confidence = Math.max(0, Math.min(1, this.confidence))
    this.frustration = Math.max(0, Math.min(1, this.frustration))
    this.engagement = Math.max(0, Math.min(1, this.engagement))

    // Record history
    this.recordHistory(event, magnitude)
  }

  /**
   * Natural decay of emotions over time
   * (frustration fades, engagement resets)
   */
  decayEmotions(minutes: number = 5): void {
    const decayFactor = Math.pow(0.95, minutes) // 5% decay per minute

    this.frustration *= decayFactor
    this.engagement *= decayFactor * 0.8 // Engagement decays faster

    // Confidence slowly returns to center
    this.confidence += (0.5 - this.confidence) * (1 - decayFactor) * 0.1
  }

  /**
   * Get overall mood descriptor
   */
  getMood(): 'happy' | 'neutral' | 'frustrated' | 'bored' | 'uncertain' {
    const c = this.confidence
    const f = this.frustration
    const e = this.engagement

    if (f > 0.6) return 'frustrated'
    if (e < 0.2) return 'bored'
    if (c < 0.3) return 'uncertain'
    if (c > 0.7 && e > 0.6) return 'happy'
    return 'neutral'
  }

  /**
   * Get mood emoji
   */
  getMoodEmoji(): string {
    switch (this.getMood()) {
      case 'happy':
        return '😊'
      case 'frustrated':
        return '😤'
      case 'bored':
        return '😴'
      case 'uncertain':
        return '🤔'
      case 'neutral':
        return '😐'
    }
  }

  /**
   * Get emotional profile for logging
   */
  getProfile(): string {
    const c = Math.round(this.confidence * 100)
    const f = Math.round(this.frustration * 100)
    const e = Math.round(this.engagement * 100)

    return `${this.getMoodEmoji()} Confidence: ${c}% | Frustration: ${f}% | Engagement: ${e}%`
  }

  /**
   * Record in history (with LRU eviction)
   */
  private recordHistory(event: string, magnitude: number): void {
    this.history.push({
      timestamp: new Date(),
      event,
      magnitude,
      vector: this.getVector(),
    })

    if (this.history.length > this.maxHistorySize) {
      this.history.shift()
    }
  }

  /**
   * Get recent history
   */
  getHistory(limit: number = 10): EmotionHistory[] {
    return this.history.slice(-limit)
  }

  /**
   * Reset emotions (rare, like after detecting attack)
   */
  reset(): void {
    this.confidence = 0.5
    this.frustration = 0.0
    this.engagement = 0.5
    this.history = []
  }

  /**
   * Export state for persistence
   */
  export(): {
    confidence: number
    frustration: number
    engagement: number
    mood: string
  } {
    return {
      confidence: this.confidence,
      frustration: this.frustration,
      engagement: this.engagement,
      mood: this.getMood(),
    }
  }

  /**
   * Import state from persistence
   */
  import(data: any): void {
    if (typeof data.confidence === 'number') this.confidence = data.confidence
    if (typeof data.frustration === 'number') this.frustration = data.frustration
    if (typeof data.engagement === 'number') this.engagement = data.engagement
  }
}

// Global instance per conversation
export const emotionalStateManager = new EmotionalState()

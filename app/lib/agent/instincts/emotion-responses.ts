/**
 * Emotion Responses — How AI behaves based on emotional state
 * 
 * Modulates system prompt, tone, and response style
 */

import { emotionalStateManager, type EmotionalVector } from './emotions'

export type ResponseTone = 
  | 'confident'      // High confidence: assertive, no disclaimers
  | 'cautious'       // Low confidence: hedging, lots of disclaimers
  | 'didactic'       // High frustration: patient, step-by-step
  | 'barebones'      // Low engagement: brief, functional
  | 'creative'       // High engagement: verbose, creative
  | 'neutral'        // Balanced

/**
 * Determine response tone from emotional state
 */
export function calculateResponseTone(emotions?: EmotionalVector): ResponseTone {
  const e = emotions || emotionalStateManager.getVector()

  if (e.frustration > 0.6) {
    return 'didactic' // Patient teaching mode
  }

  if (e.engagement < 0.2) {
    return 'barebones' // Bored: just facts
  }

  if (e.confidence < 0.3) {
    return 'cautious' // Uncertain: lots of hedging
  }

  if (e.confidence > 0.7 && e.engagement > 0.6) {
    return 'creative' // Happy confident: be creative
  }

  if (e.confidence > 0.7) {
    return 'confident' // Sure of ourselves
  }

  return 'neutral'
}

/**
 * Build emotional tone modifier for system prompt
 */
export function buildEmotionalPromptModifier(emotions?: EmotionalVector): string {
  const e = emotions || emotionalStateManager.getVector()
  const tone = calculateResponseTone(e)

  const modifiers: Record<ResponseTone, string> = {
    confident: `
You are in a confident mood. You trust your knowledge.
- Be assertive and direct
- Minimal disclaimers ("I believe" instead of "I might be wrong")
- Skip unnecessary hedging
    `.trim(),

    cautious: `
You are feeling uncertain about this topic.
- Use disclaimers: "I think...", "This might be...", "I'm not 100% sure, but..."
- Suggest verification: "You should double-check...", "Verify this with..."
- Invite correction: "Please correct me if..."
    `.trim(),

    didactic: `
You are in teaching mode (user is struggling).
- Break concepts into numbered steps
- Use analogies and examples
- Be patient and encouraging
- Assume less prior knowledge
- Go slower: assume they need clarification
    `.trim(),

    barebones: `
User seems disengaged. Be concise.
- Skip examples unless asked
- Skip creativity
- Just the facts
- Short paragraphs
    `.trim(),

    creative: `
You are feeling inspired and engaged.
- Be creative with examples
- Add humor when appropriate
- Use analogies
- Be verbose (you have permission to elaborate)
    `.trim(),

    neutral: `
You are in a balanced mood. Respond appropriately.
- Normal tone
- Be helpful and clear
- Use good judgment on detail level
    `.trim(),
  }

  return modifiers[tone]
}

/**
 * Calculate response detail level
 * Returns 0-1 (minimal to maximal)
 */
export function calculateDetailLevel(emotions?: EmotionalVector): number {
  const e = emotions || emotionalStateManager.getVector()
  const tone = calculateResponseTone(e)

  const details: Record<ResponseTone, number> = {
    confident: 0.7,   // Trusting so less detail needed
    cautious: 0.8,    // Uncertain so more detail/examples
    didactic: 0.9,    // Teaching mode: maximum detail
    barebones: 0.3,   // Disengaged: minimal
    creative: 0.95,   // Inspired: lots of detail
    neutral: 0.6,     // Balanced
  }

  return details[tone]
}

/**
 * Should include disclaimers?
 */
export function shouldIncludeDisclaimers(emotions?: EmotionalVector): boolean {
  const e = emotions || emotionalStateManager.getVector()
  const tone = calculateResponseTone(e)
  return tone === 'cautious' || tone === 'didactic'
}

/**
 * Should verify user understanding?
 * (add "Does that make sense?" type questions)
 */
export function shouldVerifyUnderstanding(emotions?: EmotionalVector): boolean {
  const e = emotions || emotionalStateManager.getVector()
  return e.frustration > 0.5 // If frustrated, check in more
}

/**
 * Build emotional health summary for logging
 */
export function buildEmotionalHealthSummary(emotions?: EmotionalVector): string {
  const e = emotions || emotionalStateManager.getVector()
  const mood = emotionalStateManager.getMood()
  const emoji = emotionalStateManager.getMoodEmoji()
  const tone = calculateResponseTone(e)

  const bars = (value: number) => {
    const filled = Math.round(value * 8)
    return '█'.repeat(filled) + '░'.repeat(8 - filled)
  }

  return `
${emoji} EMOTIONAL STATE
Mood: ${mood} | Tone: ${tone}
├─ Confidence: ${bars(e.confidence)} ${Math.round(e.confidence * 100)}%
├─ Frustration: ${bars(e.frustration)} ${Math.round(e.frustration * 100)}%
└─ Engagement: ${bars(e.engagement)} ${Math.round(e.engagement * 100)}%
  `.trim()
}

/**
 * Transform response based on emotional state
 */
export function transformResponseForEmotion(
  baseResponse: string,
  emotions?: EmotionalVector,
): string {
  const e = emotions || emotionalStateManager.getVector()
  const tone = calculateResponseTone(e)
  const shouldDisclaim = shouldIncludeDisclaimers(e)
  const shouldVerify = shouldVerifyUnderstanding(e)

  let transformed = baseResponse

  // Add disclaimers if cautious
  if (shouldDisclaim && !baseResponse.includes('might')) {
    transformed = `I think ${transformed.charAt(0).toLowerCase() + transformed.slice(1)}`
  }

  // Add verification check if frustrated
  if (shouldVerify && !baseResponse.includes('Does that')) {
    transformed += '\n\nDoes that make sense? Let me know if you need clarification.'
  }

  // Shorten if barebones tone
  if (tone === 'barebones') {
    const sentences = transformed.split('.')
    transformed = sentences.slice(0, Math.min(2, sentences.length)).join('.')
  }

  return transformed
}

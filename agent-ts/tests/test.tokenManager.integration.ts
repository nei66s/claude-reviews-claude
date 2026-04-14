import { describe, it, expect } from 'vitest'
import { estimateTokens } from '../src/tokenManager'

describe('TokenManager — Unit Tests', () => {
  it('should estimate tokens from text', () => {
    const text = 'Hello world this is a test'
    const tokens = estimateTokens(text)
    expect(tokens).toBeGreaterThan(0)
    expect(tokens).toBeLessThanOrEqual(2000)
  })

  it('should handle empty text', () => {
    const tokens = estimateTokens('')
    expect(tokens).toBeGreaterThanOrEqual(10) // MIN is 10
  })

  it('should respect max token limit', () => {
    const longText = 'a'.repeat(100000)
    const tokens = estimateTokens(longText)
    expect(tokens).toBeLessThanOrEqual(2000) // MAX is 2000
  })

  it('should estimate approximately 1 token per 4 characters', () => {
    const text = 'a'.repeat(400)
    const tokens = estimateTokens(text)
    // Expected: ~100 tokens (400 * 0.25)
    expect(tokens).toBeGreaterThanOrEqual(95)
    expect(tokens).toBeLessThanOrEqual(105)
  })

  it('should estimate realistic message size', () => {
    const message =
      'Can you help me write a TypeScript function that validates email addresses using regex patterns?'
    const tokens = estimateTokens(message)
    expect(tokens).toBeGreaterThan(10)
    expect(tokens).toBeLessThanOrEqual(100)
  })

  it('should estimate code snippet size', () => {
    const code = `function fibonacci(n: number): number {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
}`
    const tokens = estimateTokens(code)
    expect(tokens).toBeGreaterThan(20)
    expect(tokens).toBeLessThanOrEqual(200)
  })
})

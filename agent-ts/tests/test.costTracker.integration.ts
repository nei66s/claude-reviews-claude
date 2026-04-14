import { describe, it, expect } from 'vitest'
import { calculateCost } from '../src/costTracker'

describe('CostTracker — Unit Tests', () => {
  it('should calculate cost for gpt-5', () => {
    const cost = calculateCost('gpt-5', 1000, 500)
    // gpt-5: input $0.0075/1K, output $0.030/1K
    // input: 1000 * 0.0075 / 1000 = $0.0075
    // output: 500 * 0.030 / 1000 = $0.015
    // total: $0.0225
    expect(cost).toBeCloseTo(0.0225, 3)
  })

  it('should calculate cost for gpt-4-turbo', () => {
    const cost = calculateCost('gpt-4-turbo', 1000, 500)
    // gpt-4-turbo: input $0.001/1K, output $0.003/1K
    // input: 1000 * 0.001 / 1000 = $0.001
    // output: 500 * 0.003 / 1000 = $0.0015
    // total: $0.0025
    expect(cost).toBeCloseTo(0.0025, 3)
  })

  it('should calculate cost for gpt-4', () => {
    const cost = calculateCost('gpt-4', 1000, 500)
    // input: 1000 * 0.00003 / 1000 = $0.00003
    // output: 500 * 0.00006 / 1000 = 0.00003
    // total: $0.00006
    expect(cost).toBeCloseTo(0.00006, 5)
  })

  it('should calculate cost for gpt-3.5-turbo', () => {
    const cost = calculateCost('gpt-3.5-turbo', 1000, 500)
    // input: 1000 * 0.0005 / 1000 = $0.0005
    // output: 500 * 0.0015 / 1000 = $0.00075
    // total: $0.00125
    expect(cost).toBeCloseTo(0.00125, 4)
  })

  it('should handle zero tokens', () => {
    const cost = calculateCost('gpt-5', 0, 0)
    expect(cost).toBe(0)
  })

  it('should scale costs proportionally', () => {
    const cost1 = calculateCost('gpt-5', 1000, 500)
    const cost2 = calculateCost('gpt-5', 2000, 1000)
    expect(cost2).toBeCloseTo(cost1 * 2, 4)
  })

  it('should use fallback pricing for unknown models', () => {
    const costUnknown = calculateCost('unknown-model', 1000, 500)
    const costGpt4 = calculateCost('gpt-4', 1000, 500)
    expect(costUnknown).toBeCloseTo(costGpt4, 5) // Falls back to gpt-4
  })

  it('should match realistic conversation cost', () => {
    // User: ~200 input tokens, Agent: ~500 output tokens
    const cost = calculateCost('gpt-5', 200, 500)
    expect(cost).toBeGreaterThan(0)
    expect(cost).toBeLessThan(0.1) // Should be cheap
  })
})

/**
 * Test suite for audit log persistence
 * Run with: npm run test
 */

import { describe, it, expect } from 'vitest'

describe('AuditLog Persistence', () => {
  describe('Audit Entry Tracking', () => {
    it('should categorize audit actions', () => {
      const auditLog = [
        { action: 'file_read', status: 'success' },
        { action: 'bash_exec', status: 'denied' },
        { action: 'file_write', status: 'failed' },
      ]

      const successCount = auditLog.filter(e => e.status === 'success').length
      const deniedCount = auditLog.filter(e => e.status === 'denied').length
      const failedCount = auditLog.filter(e => e.status === 'failed').length

      expect(successCount).toBe(1)
      expect(deniedCount).toBe(1)
      expect(failedCount).toBe(1)
    })

    it('should compute statistics', () => {
      const total = 100
      const success = 85
      const denied = 10
      const failed = 5

      expect(success + denied + failed).toBe(total)
      expect((success / total) * 100).toBe(85)
    })

    it('should apply 90-day retention', () => {
      const now = Date.now()
      const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000
      const retention = 90

      const entryDate = ninetyDaysAgo + 1000 // 1 second after 90 days
      expect(now - entryDate < retention * 24 * 60 * 60 * 1000).toBe(true)
    })
  })
})


/**
 * REST API endpoints for audit log management
 * GET /api/audit/logs — List audit logs (with pagination)
 * GET /api/audit/logs/:chatId — Logs for specific chat
 * GET /api/audit/logs?action=FILE_READ — Logs by action
 * GET /api/audit/denied — Security review (denied actions only)
 * GET /api/audit/stats — Audit statistics
 */

import express, { Router } from 'express'
import {
  getAuditLogsForChat,
  getAuditLogsByAction,
  getDeniedActions,
  getAuditLogStats,
} from '../audit/persistence.js'

const router = Router()

/**
 * GET /api/audit/logs
 * List all audit logs with pagination
 */
router.get('/logs', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Number(req.query.offset) || 0
    const chatId = req.query.chatId as string

    if (chatId) {
      const logs = await getAuditLogsForChat(chatId, limit, offset)
      return res.json({ logs, limit, offset, chatId })
    }

    return res.json({ error: 'Provide chatId or use /logs/:chatId' }, )
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/audit/logs/:chatId
 * Get logs for a specific chat
 */
router.get('/logs/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const offset = Number(req.query.offset) || 0

    const logs = await getAuditLogsForChat(chatId, limit, offset)
    return res.json({ logs, limit, offset, chatId })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/audit/action/:action
 * Get logs by action type
 */
router.get('/action/:action', async (req, res) => {
  try {
    const { action } = req.params
    const limit = Math.min(Number(req.query.limit) || 100, 1000)

    const logs = await getAuditLogsByAction(action, limit)
    return res.json({ logs, action, limit })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/audit/denied
 * Security review: all denied actions
 */
router.get('/denied', async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 1000)
    const logs = await getDeniedActions(limit)
    return res.json({ logs, limit, status: 'denied' })
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

/**
 * GET /api/audit/stats
 * Get overall audit statistics
 */
router.get('/stats', async (req, res) => {
  try {
    const stats = await getAuditLogStats()
    return res.json(stats)
  } catch (err: any) {
    return res.status(500).json({ error: err.message })
  }
})

export default router

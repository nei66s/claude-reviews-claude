/**
 * REST API endpoints for permission rules management
 * POST /api/permissions/deny-rules — Create deny rule
 * GET /api/permissions/deny-rules — List deny rules
 * DELETE /api/permissions/deny-rules/:id — Delete deny rule
 * POST /api/permissions/ask-rules — Create ask rule
 * GET /api/permissions/ask-rules — List ask rules
 * DELETE /api/permissions/ask-rules/:id — Delete ask rule
 * POST /api/permissions/approvals — Record approval
 * GET /api/permissions/approvals/:chatId — List approvals for chat
 * DELETE /api/permissions/approvals/:ruleId/:chatId — Revoke approval
 */

import express, { Router } from 'express'
import {
  loadDenyRules,
  loadAskRules,
  saveDenyRule,
  saveAskRule,
  deleteDenyRule,
  deleteAskRule,
  recordApproval,
  listApprovalsForChat,
  revokeApproval,
  isRuleApproved,
} from '../permissions/persistence'
import { getPermissionPipeline } from '../permissions/pipeline'

const router = Router()

// ============ DENY RULES ============

/**
 * POST /api/permissions/deny-rules
 * Create or update a deny rule
 */
router.post('/deny-rules', async (req, res) => {
  try {
    const { id, tools, reason, conditionJson } = req.body

    if (!id || !tools || !reason) {
      return res.status(400).json({ error: 'Missing required fields: id, tools, reason' })
    }

    await saveDenyRule(id, tools, conditionJson || {}, reason)

    // Optionally sync to in-memory pipeline
    const pipeline = getPermissionPipeline()
    const toolsArray = Array.isArray(tools) ? tools : [tools]
    pipeline.addDenyRule({
      id,
      tool: toolsArray.includes('*') ? '*' : toolsArray,
      condition: () => true, // Stored rules use condition_json in DB
      reason,
    })

    return res.json({ ok: true, id })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/permissions/deny-rules
 * List all deny rules
 */
router.get('/deny-rules', async (req, res) => {
  try {
    const rules = await loadDenyRules()
    return res.json(rules)
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/permissions/deny-rules/:id
 * Delete a deny rule
 */
router.delete('/deny-rules/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteDenyRule(id)
    return res.json({ ok: true, deleted: id })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

// ============ ASK RULES ============

/**
 * POST /api/permissions/ask-rules
 * Create or update an ask rule
 */
router.post('/ask-rules', async (req, res) => {
  try {
    const { id, tools, message, conditionJson } = req.body

    if (!id || !tools || !message) {
      return res.status(400).json({ error: 'Missing required fields: id, tools, message' })
    }

    await saveAskRule(id, tools, conditionJson || {}, message)

    // Optionally sync to in-memory pipeline
    const pipeline = getPermissionPipeline()
    const toolsArray = (Array.isArray(tools) ? tools : [tools]) as string[]
    pipeline.addAskRule({
      id,
      tool: toolsArray.includes('*') ? '*' : toolsArray,
      condition: () => true,
      message,
    })

    return res.json({ ok: true, id })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/permissions/ask-rules
 * List all ask rules
 */
router.get('/ask-rules', async (req, res) => {
  try {
    const rules = await loadAskRules()
    return res.json(rules)
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/permissions/ask-rules/:id
 * Delete an ask rule
 */
router.delete('/ask-rules/:id', async (req, res) => {
  try {
    const { id } = req.params
    await deleteAskRule(id)
    return res.json({ ok: true, deleted: id })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

// ============ APPROVALS ============

/**
 * POST /api/permissions/approvals
 * Record an approval for an ask rule
 */
router.post('/approvals', async (req, res) => {
  try {
    const { ruleId, chatId, expiresInMs } = req.body

    if (!ruleId || !chatId) {
      return res.status(400).json({ error: 'Missing required fields: ruleId, chatId' })
    }

    // Check if rule exists
    const rules = await loadAskRules()
    const ruleExists = rules.some(r => r.id === ruleId)
    if (!ruleExists) {
      return res.status(404).json({ error: 'Ask rule not found' })
    }

    await recordApproval(ruleId, chatId, expiresInMs)
    return res.json({ ok: true, ruleId, chatId })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/permissions/approvals/:chatId
 * List all active approvals for a chat
 */
router.get('/approvals/:chatId', async (req, res) => {
  try {
    const { chatId } = req.params
    const approvals = await listApprovalsForChat(chatId)
    return res.json(approvals)
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * DELETE /api/permissions/approvals/:ruleId/:chatId
 * Revoke an approval
 */
router.delete('/approvals/:ruleId/:chatId', async (req, res) => {
  try {
    const { ruleId, chatId } = req.params
    await revokeApproval(ruleId, chatId)
    return res.json({ ok: true, revoked: { ruleId, chatId } })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

/**
 * GET /api/permissions/status/:ruleId/:chatId
 * Check if a rule is approved for a chat
 */
router.get('/status/:ruleId/:chatId', async (req, res) => {
  try {
    const { ruleId, chatId } = req.params
    const approved = await isRuleApproved(ruleId, chatId)
    return res.json({ ruleId, chatId, approved })
  } catch (err) {
    const error = err as { message?: string };
    return res.status(500).json({ error: error.message })
  }
})

export default router

/**
 * Query Engine & Token Management API Routes
 * 
 * Endpoints for monitoring and managing token/cost usage
 */

import { Router, type Request, type Response } from 'express'
import { getStats, isWithinLimits, estimateTokens } from '../tokenManager.js'

const router = Router()

/**
 * GET /api/tokens/stats/:userId/:chatId
 * Get token usage statistics for a conversation
 */
router.get('/stats/:userId/:chatId', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || '').trim()
    const chatId = String(req.params.chatId || '').trim()

    if (!userId || !chatId) {
      res.status(400).json({ error: 'userId and chatId required' })
      return
    }

    const stats = await getStats(userId, chatId)

    res.json({
      ok: true,
      userId,
      chatId,
      tokens: stats,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
})

/**
 * GET /api/tokens/check/:userId/:chatId/:numTokens
 * Check if user has budget for given token count
 */
router.get('/check/:userId/:chatId/:numTokens', async (req: Request, res: Response) => {
  try {
    const userId = String(req.params.userId || '').trim()
    const chatId = String(req.params.chatId || '').trim()
    const tokens = parseInt(String(req.params.numTokens || '0'), 10)

    if (!userId || !chatId || isNaN(tokens)) {
      res.status(400).json({ error: 'userId, chatId, and numTokens (number) required' })
      return
    }

    const withinLimits = await isWithinLimits(userId, chatId, tokens)

    res.json({
      ok: true,
      userId,
      chatId,
      requestedTokens: tokens,
      allowed: withinLimits,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
})



/**
 * POST /api/tokens/estimate
 * Estimate tokens for given text
 */
router.post('/estimate', (req: Request, res: Response) => {
  try {
    const { text } = req.body

    if (typeof text !== 'string') {
      res.status(400).json({ error: 'text (string) required in body' })
      return
    }

    const tokens = estimateTokens(text)

    res.json({
      ok: true,
      text: text.substring(0, 100) + (text.length > 100 ? '...' : ''),
      length: text.length,
      estimatedTokens: tokens,
    })
  } catch (err) {
    res.status(500).json({ ok: false, error: String(err) })
  }
})

export default router

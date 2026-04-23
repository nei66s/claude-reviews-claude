import { Router } from 'express'
import { describePersonality, AGENT_IDENTITY, getPersonalityGreeting } from '../personality'

const router = Router()

/**
 * GET /api/agent/identity
 * Returns the agent's personality and identity information
 */
router.get('/identity', (req, res) => {
  res.json({
    ok: true,
    agent: {
      name: AGENT_IDENTITY.name,
      emoji: AGENT_IDENTITY.emoji,
      nickname: AGENT_IDENTITY.nickname,
      relationship: AGENT_IDENTITY.relationship,
      ageMonths: AGENT_IDENTITY.birthDateMonthsAgo,
      description: AGENT_IDENTITY.description,
    },
  })
})

/**
 * GET /api/agent/personality
 * Returns a full description of the agent's personality
 */
router.get('/personality', (req, res) => {
  res.json({
    ok: true,
    personality: describePersonality(),
  })
})

/**
 * GET /api/agent/greeting
 * Returns a randomized personality-driven greeting
 */
router.get('/greeting', (req, res) => {
  res.json({
    ok: true,
    greeting: getPersonalityGreeting(),
    agent: AGENT_IDENTITY.name,
  })
})

export default router

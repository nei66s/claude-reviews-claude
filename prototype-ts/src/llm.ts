import fetch from 'node-fetch'
import dotenv from 'dotenv'

dotenv.config()

const OPENAI_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini'

export async function chat(messages: unknown) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify({ model: MODEL, messages }),
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(`LLM request failed: ${resp.status} ${text}`)
  }

  return resp.json()
}

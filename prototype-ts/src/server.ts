import express from 'express'
import dotenv from 'dotenv'
import path from 'path'
import { chat } from './llm.js'
import { runTool } from './tools.js'
import { moderateText } from './moderation.js'

dotenv.config()

const app = express()
app.use(express.json())

const PROJECT_ROOT = path.resolve(__dirname, '..', '..')

app.post('/chat', async (req, res) => {
  const messages = req.body?.messages
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages required (array)' })

  // Simple moderation: join user messages and check
  const userText = messages.map((m: any) => m.content || '').join('\n')
  try {
    const mod = await moderateText(userText)
    if (!mod.allowed) return res.status(403).json({ error: 'content blocked by moderation', details: mod })

    const result = await chat(messages)
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

app.post('/tools/run', async (req, res) => {
  const tool = req.body?.tool
  const input = req.body?.input
  if (!tool) return res.status(400).json({ error: 'tool required' })

  // Basic input validation & sandboxing
  try {
    if (tool === 'file.read') {
      const rel = input?.path
      if (!rel) return res.status(400).json({ error: 'input.path required for file.read' })
      const abs = path.resolve(PROJECT_ROOT, rel)
      if (!abs.startsWith(PROJECT_ROOT)) return res.status(400).json({ error: 'path outside project not allowed' })
    }

    if (tool === 'bash.exec') {
      const cmd = String(input?.cmd || '')
      // Allow only simple safe commands: echo, ls, dir, cat, type
      const safe = /^(?:\s*)(?:echo|ls|dir|cat|type)\b/iu
      if (!safe.test(cmd)) return res.status(400).json({ error: 'command not allowed' })
    }

    const out = await runTool(tool, input)
    res.json(out)
  } catch (err) {
    res.status(500).json({ error: String(err) })
  }
})

const port = process.env.PORT || 3000
app.listen(port, () => console.log(`Prototype server listening on ${port}`))

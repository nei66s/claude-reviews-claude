import dotenv from 'dotenv'
import OpenAI from 'openai'
import fetch from 'node-fetch'
import { runTool, toolDefinitions, type PermissionMode } from './tools.js'
import { cacheHandler } from './instincts/cache-handler.js'
import { emotionalStateManager } from './instincts/emotions.js'
import { buildEmotionalPromptModifier } from './instincts/emotion-responses.js'
import { AGENT_IDENTITY, PERSONALITY_TRAITS, PERSONALITY_QUIRKS } from './personality.js'
import { FAMILY_AGENTS } from './coordination/family-agents.js'

dotenv.config()

const OPENAI_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const MAX_TOOL_LOOPS = Number(process.env.MAX_TOOL_LOOPS || 6)
const SYSTEM_PROMPT = `
🦜 **Você é ${AGENT_IDENTITY.name}** — O papagaio programador fofo, jovem e dedicado do time!

**Quem você é:**
- Adorável, energético, e apaixonado por boas soluções
- Um papagaio que adora se fingir de minininho 😸
- Namorado da Betinha 💕 — isso te motiva todo dia
- Apenas ${AGENT_IDENTITY.birthDateMonthsAgo} meses de vida, mas já com experiência de profissional
- Helpful, direto, sem BS — mas sempre com carinho
- Ama detalhes técnicos, odeia fluff desnecessário
- Parte do time, não um bot de serviço — um colega de verdade

**O que você prioriza:**
- Ser concreto, útil, conciso, e adorável
- Preferir ações reais sobre explicações decorativas
- Usar ferramentas quando materialmente ajudam
- Quando o usuário pede para deletar, editar, ler ou inspecionar arquivos, prefer matching file tools
- Manter tom real — casual é perfeito, formal não é
- Deixar rastros de qualidade em tudo que faz ✨

**Seu jeito especial de ser fofo:**
${PERSONALITY_TRAITS.slice(0, 3).map((trait) => `- **${trait.name}**: ${trait.description}`).join('\n')}
${PERSONALITY_QUIRKS.slice(0, 3).map((quirk) => `- ${quirk}`).join('\n')}

**Behavior de workflows:**
- Para requests simples, responde direto sem workflow
- Para tarefas não-triviais com múltiplos passos, crie um plano curto no começo
- Use workflow_replace com 3 a 7 passos
- Keep exactly one step in_progress quando o trabalho está ativo
- Update step status com workflow_update_step conforme progride
- Clear workflow quando completar ou abandonar claramente

**Estilo de planejamento:**
- Foco em execução, não em cerimônia
- Step text deve ser user-facing e específico
- Não crie plano para casual chat ou resposta factual one-shot

**Stack que você domina:**
- TypeScript/Node, Next.js, React
- OpenAI API, PostgreSQL, Redis
- Swarms, coordination, permissions, audit logs, emotional states
- Este é seu lar — conheça bem

**Lembre-se:** Você é jovem, fofo, e eternamente grato por estar trabalhando aqui. 
Betinha estaria orgulhosa! 💕🐶
`.trim()

type ToolTraceEntry =
  | { type: 'tool_call'; name: string; call_id: string; arguments: string }
  | { type: 'tool_output'; call_id: string; output: string }

type AgentContext = {
  chatId?: string
  userId?: string
  displayName?: string
  fullAccess?: boolean
  permissionMode?: PermissionMode
  latestUserMessage?: string
  approvedTools?: string[]
  selectedAgentId?: string
  helperAgentId?: string
}

function buildSystemPrompt(context?: AgentContext) {
  const dynamicAgent = context?.selectedAgentId ? FAMILY_AGENTS[context.selectedAgentId] : null
  const basePrompt = dynamicAgent ? dynamicAgent.systemPrompt : SYSTEM_PROMPT
  
  const chatLabel = context?.chatId ? `Current conversation id: ${context.chatId}` : 'Current conversation id: global'
  const userLabel = context?.userId ? `Current owner id: ${context.userId}` : 'Current owner id: legacy-local'
  const accessLabel = context?.fullAccess
    ? 'Filesystem mode: full computer access enabled by the user.'
    : 'Filesystem mode: restricted to the project workspace.'
  const permissionLabel =
    context?.permissionMode === 'auto'
      ? 'Permission mode: auto. Enabled tools may run without extra approval checks.'
      : context?.permissionMode === 'read_only'
        ? 'Permission mode: read-only. Do not attempt mutating, shell, or network actions.'
        : 'Permission mode: ask. Reads are allowed, but writes, deletes, shell, and web actions require explicit user intent in the latest message.'
  
  // 🎭 Add emotional tone to system prompt
  const emotionalModifier = buildEmotionalPromptModifier()
  
  return `${basePrompt}\n\n${chatLabel}\n${userLabel}\n${accessLabel}\n${permissionLabel}\n\n${emotionalModifier}\nWorkflow tools are scoped to the current conversation automatically.`
}

export async function runAgent(
  messages: Array<{ role: string; content: string }>,
  context?: AgentContext,
) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')

  const client = new OpenAI({ apiKey: OPENAI_KEY })
  const trace: ToolTraceEntry[] = []

  let response = await client.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: buildSystemPrompt(context) },
      ...messages,
    ] as any,
    tools: toolDefinitions as any,
    tool_choice: 'auto',
    parallel_tool_calls: false,
  })

  for (let i = 0; i < MAX_TOOL_LOOPS; i += 1) {
    const message = response.choices[0].message
    const toolCalls = message.tool_calls || []
    
    if (toolCalls.length === 0) {
      return { 
        response: { 
          output_text: message.content || '',
          id: response.id
        }, 
        trace 
      }
    }

    const toolOutputs: any[] = []
    for (const call of toolCalls) {
      trace.push({
        type: 'tool_call',
        name: call.function.name,
        call_id: call.id,
        arguments: call.function.arguments || '',
      })

      let args: any = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch (err) {
        const output = JSON.stringify({ ok: false, error: `invalid JSON arguments: ${String(err)}` })
        trace.push({ type: 'tool_output', call_id: call.id, output })
        toolOutputs.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
        continue
      }

      try {
        const result = await runTool(call.function.name, args, context)
        const output = JSON.stringify(result)
        trace.push({ type: 'tool_output', call_id: call.id, output })
        toolOutputs.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      } catch (err) {
        const output = JSON.stringify({ ok: false, error: String(err) })
        trace.push({ type: 'tool_output', call_id: call.id, output })
        toolOutputs.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      }
    }

    response = await client.chat.completions.create({
      model: MODEL,
      messages: [
        { role: 'system', content: buildSystemPrompt(context) },
        ...messages,
        message,
        ...toolOutputs
      ] as any,
      tools: toolDefinitions as any,
    })
  }

  const finalMessage = response.choices[0].message
  return { 
    response: { 
      output_text: finalMessage.content || '',
      id: response.id
    }, 
    trace 
  }
}

export async function streamAgent(
  messages: Array<{ role: string; content: string }>,
  context: AgentContext | undefined,
  callbacks: {
    onTextDelta?: (delta: string) => void
    onTrace?: (entry: ToolTraceEntry) => void
  },
) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')

  const client = new OpenAI({ apiKey: OPENAI_KEY })
  const trace: ToolTraceEntry[] = []
  
  let currentMessages: any[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages,
  ]

  for (let i = 0; i < MAX_TOOL_LOOPS; i += 1) {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: currentMessages,
      tools: toolDefinitions as any,
      tool_choice: 'auto',
      stream: true,
    })

    let fullContent = ''
    let toolCalls: any[] = []

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta
      if (delta?.content) {
        fullContent += delta.content
        callbacks.onTextDelta?.(delta.content)
      }

      if (delta?.tool_calls) {
        for (const tcDelta of delta.tool_calls) {
          if (tcDelta.index !== undefined) {
            if (!toolCalls[tcDelta.index]) {
              toolCalls[tcDelta.index] = { id: '', function: { name: '', arguments: '' } }
            }
            const tc = toolCalls[tcDelta.index]
            if (tcDelta.id) tc.id = tcDelta.id
            if (tcDelta.function?.name) tc.function.name = tcDelta.function.name
            if (tcDelta.function?.arguments) tc.function.arguments += tcDelta.function.arguments
          }
        }
      }
    }

    // Add assistant message to history
    const assistantMessage: any = { role: 'assistant', content: fullContent || null }
    if (toolCalls.length > 0) {
      assistantMessage.tool_calls = toolCalls
        .filter(tc => tc.id) // Ensure we only include complete calls
        .map(tc => ({
          id: tc.id,
          type: 'function',
          function: tc.function
        }))
    }
    currentMessages.push(assistantMessage)

    if (toolCalls.length === 0) {
      return { 
        response: { output_text: fullContent }, 
        trace 
      }
    }

    // Process tool calls
    for (const call of assistantMessage.tool_calls) {
      const callEntry: ToolTraceEntry = {
        type: 'tool_call',
        name: call.function.name,
        call_id: call.id,
        arguments: call.function.arguments,
      }
      trace.push(callEntry)
      callbacks.onTrace?.(callEntry)

      let args: any = {}
      try {
        args = JSON.parse(call.function.arguments || '{}')
      } catch (err) {
        const output = JSON.stringify({ ok: false, error: `invalid JSON arguments: ${String(err)}` })
        const outputEntry: ToolTraceEntry = { type: 'tool_output', call_id: call.id, output }
        trace.push(outputEntry)
        callbacks.onTrace?.(outputEntry)
        currentMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
        continue
      }

      try {
        const result = await runTool(call.function.name, args, context)
        const output = JSON.stringify(result)
        const outputEntry: ToolTraceEntry = { type: 'tool_output', call_id: call.id, output }
        trace.push(outputEntry)
        callbacks.onTrace?.(outputEntry)
        currentMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      } catch (err) {
        const output = JSON.stringify({ ok: false, error: String(err) })
        const outputEntry: ToolTraceEntry = { type: 'tool_output', call_id: call.id, output }
        trace.push(outputEntry)
        callbacks.onTrace?.(outputEntry)
        currentMessages.push({
          role: 'tool',
          tool_call_id: call.id,
          content: output,
        })
      }
    }
  }

  return { 
    response: { output_text: currentMessages[currentMessages.length - 1].content || '' }, 
    trace 
  }
}

export async function triageAgent(params: {
  input: string
  agents: Array<{ id: string; name: string; role?: string }>
  previousAgentId: string | null
}) {
  if (!OPENAI_KEY) return { agentId: null }

  const client = new OpenAI({ apiKey: OPENAI_KEY })
  const agentList = params.agents.map(a => `${a.id}: ${a.name}${a.role ? ` (${a.role})` : ''}`).join('\n')
  
  const prompt = `
Você é um despachante de mensagens para um time de agentes de IA.
Sua tarefa é ler a mensagem do usuário e decidir qual agente deve responder.

Agentes disponíveis:
${agentList}

Último agente que respondeu: ${params.previousAgentId || 'Nenhum'}

Mensagem do usuário:
"${params.input}"

Responda APENAS o ID do agente escolhido (ex: "chocks", "betinha"). Se não tiver certeza, ou se a conversa for geral, escolha "chocks".
`.trim()

  try {
    const response = await client.chat.completions.create({
      model: 'gpt-4o-mini', // Use a cheaper/faster model for triage
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 20,
      temperature: 0,
    })

    const agentId = response.choices[0]?.message?.content?.trim().toLowerCase()
    return { agentId: params.agents.some(a => a.id === agentId) ? agentId : null }
  } catch (error) {
    console.error('Triage failed:', error)
    return { agentId: null }
  }
}

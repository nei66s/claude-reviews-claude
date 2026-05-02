import { Runner } from '@openai/agents'
import { runTool, toolDefinitions, type PermissionMode, type ToolContext } from './tools'
import { getAgentInstance } from './coordination/family-agents'
import { getSDKTools } from './sdk-tools'
import OpenAI from 'openai'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const SMALL_MODEL = process.env.OPENAI_SMALL_MODEL || 'gpt-4o-mini'

/**
 * Returns a configured OpenAI client with a 15-minute timeout as recommended for Flex processing.
 */
function getOpenAIClient() {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')
  return new OpenAI({
    apiKey: OPENAI_KEY,
    timeout: 15 * 60 * 1000 // 🚀 15 min timeout
  })
}

/**
 * Helper to wrap OpenAI calls with exponential backoff for Flex "Resource Unavailable" errors (429).
 */
async function withFlexRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  let delay = 2000
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn()
    } catch (err: unknown) {
      const error = err as { status?: number; message?: string }
      const isResourceUnavailable = error?.status === 429 && error?.message?.toLowerCase().includes('resource unavailable')
      if (isResourceUnavailable && i < maxRetries - 1) {
        console.warn(`[Flex] Resource unavailable, retrying in ${delay}ms... (Attempt ${i + 1}/${maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, delay))
        delay *= 2
        continue
      }
      throw err
    }
  }
  throw new Error('Max retries exceeded')
}

export type ToolTraceEntry =
  | { type: 'tool_call'; name: string; call_id: string; arguments: string }
  | { type: 'tool_output'; call_id: string; output: string }

export type AgentContext = {
  chatId?: string
  userId?: string
  displayName?: string
  fullAccess?: boolean
  permissionMode?: PermissionMode
  latestUserMessage?: string
  approvedTools?: string[]
  selectedAgentId?: string
  helperAgentId?: string
  memoryContext?: unknown
  psychProfile?: unknown
  systemPromptOverride?: string
  maxTokens?: number
  compactThreshold?: number
}

export type ResponseItem = 
  | { type: 'message'; role: 'user' | 'assistant' | 'system'; content: string | unknown[] }
  | { type: 'compaction'; value: string }
  | { type: 'tool_call'; id: string; function: { name: string; arguments: string } }
  | { type: 'tool_output'; tool_call_id: string; content: string }

/**
 * Main agent runner using the official OpenAI Agents SDK.
 */
export async function runAgent(
  messages: Array<{ role: string; content: string }>,
  context?: AgentContext,
) {
  const agentId = context?.selectedAgentId || 'chocks'
  const agent = getAgentInstance(agentId)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const trace: ToolTraceEntry[] = []
  const sdkTools = getSDKTools(context)

  const stream = Runner.run(agent, messages as unknown as any, {
    metadata: context,
    tools: sdkTools,
  })

  for await (const event of stream) {
    if (event.type === 'tool_call') {
      trace.push({
        type: 'tool_call',
        name: event.function?.name || 'unknown',
        call_id: event.id,
        arguments: JSON.stringify(event.function?.arguments || {}),
      })
    } else if (event.type === 'tool_output') {
      trace.push({
        type: 'tool_output',
        call_id: event.tool_call_id,
        output: JSON.stringify(event.output),
      })
    }
  }

  const result = await stream.final_result()

  return {
    response: {
      output_text: result.final_output || '',
      id: result.run_id,
      finalAgentId: result.agent?.name?.toLowerCase() || agentId
    },
    trace
  }
}

/**
 * Streaming agent runner using the official OpenAI Agents SDK.
 */
export async function streamAgent(
  messages: Array<{ role: string; content: string }>,
  context: AgentContext | undefined,
  callbacks: {
    onTextDelta?: (delta: string) => void
    onTrace?: (entry: ToolTraceEntry) => void
    onCompaction?: (item: unknown) => void
  },
) {
  const agentId = context?.selectedAgentId || 'chocks'
  const agent = getAgentInstance(agentId)
  if (!agent) throw new Error(`Agent not found: ${agentId}`)

  const sdkTools = getSDKTools(context)

  const stream = Runner.run(agent, messages as unknown as any, {
    metadata: context,
    tools: sdkTools,
  })

  const trace: ToolTraceEntry[] = []
  for await (const event of stream) {
    if (event.type === 'text_delta') {
      callbacks.onTextDelta?.(event.delta)
    } else if (event.type === 'tool_call') {
      const entry: ToolTraceEntry = {
        type: 'tool_call',
        name: event.function?.name || 'unknown',
        call_id: event.id,
        arguments: JSON.stringify(event.function?.arguments || {}),
      }
      trace.push(entry)
      callbacks.onTrace?.(entry)
    } else if (event.type === 'tool_output') {
      const entry: ToolTraceEntry = {
        type: 'tool_output',
        call_id: event.tool_call_id,
        output: JSON.stringify(event.output),
      }
      trace.push(entry)
      callbacks.onTrace?.(entry)
    } else if (event.type === 'compaction') {
      callbacks.onCompaction?.(event.item)
    }
  }

  const result = await stream.final_result()
  return {
    response: {
      output_text: result.final_output || '',
      id: result.run_id,
      finalAgentId: result.agent?.name?.toLowerCase() || agentId
    },
    trace
  }
}

/**
 * Versão ultra-leve para a Sala de Convivência
 */
export async function runSimpleChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  options: { maxTokens?: number } = {}
) {
  const client = getOpenAIClient()

  const response = await withFlexRetry(() => client.chat.completions.create({
    model: SMALL_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    max_tokens: options.maxTokens || 100,
    temperature: 0.8
  } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming))

  return {
    output: response.choices[0].message.content || '',
    id: response.id
  }
}

/**
 * Counts the tokens that would be consumed by the given input.
 */
export async function countInputTokens(
  messages: Array<{ role: string; content: string }>,
  context?: AgentContext
) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')

  const body = {
    model: MODEL,
    input: messages,
    tools: toolDefinitions.map((td: { type: string; function: { name: string; description?: string; parameters: unknown } }) => ({
      type: td.type,
      name: td.function.name,
      description: td.function.description,
      parameters: td.function.parameters,
    })),
    prompt_cache_key: context?.selectedAgentId ? `agent-${context.selectedAgentId}` : 'pimpotasma-default',
    prompt_cache_retention: 'in-memory'
  }

  const response = await fetch('https://api.openai.com/v1/responses/input_tokens', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${OPENAI_KEY}`,
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const errorBody = await response.text()
    console.error('Token count API error:', errorBody)
    throw new Error(`Failed to count tokens: ${response.statusText}`)
  }

  const data = await response.json()
  return data.input_tokens as number
}

function normalizeTriageText(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function triageAgent(params: {
  input: string
  agents: Array<{ id: string; name: string; role?: string; aliases?: string[]; expertise?: string[]; keywords?: string[] }>
  previousAgentId: string | null
}) {
  const normalizedInput = normalizeTriageText(params.input);
  const greetings = ['oi', 'ola', 'fala', 'e ai', 'alo', 'opa', 'bom dia', 'boa tarde', 'boa noite', 'hey', 'hi', 'hello'];
  
  for (const agent of params.agents) {
    const terms = [agent.id.toLowerCase(), agent.name.toLowerCase(), ...(agent.aliases || [])];
    
    for (const term of terms) {
      const normalizedTerm = normalizeTriageText(term);
      if (!normalizedTerm) continue;

      if (normalizedInput.startsWith(normalizedTerm)) {
        return { agentId: agent.id };
      }
      
      for (const greeting of greetings) {
        if (normalizedInput.startsWith(`${greeting} ${normalizedTerm}`)) {
          return { agentId: agent.id };
        }
      }

      if (normalizedInput === normalizedTerm) {
        return { agentId: agent.id };
      }
    }
  }

  const client = getOpenAIClient()
  
  const agentRichContext = params.agents.map(a => {
    let info = `- ID: ${a.id}\n  Nome: ${a.name}\n  Papel: ${a.role || 'membro'}`;
    if (a.aliases?.length) info += `\n  Codinomes: ${a.aliases.join(', ')}`;
    if (a.expertise?.length) info += `\n  Expertise: ${a.expertise.join(', ')}`;
    return info;
  }).join('\n\n');
  
  const prompt = `
Você é o Despachante Inteligente da Família Pimpotasma.
Sua missão é rotear a mensagem do usuário para o AGENTE correto.

### CONTEXTO DA FAMÍLIA:
- A maioria dos agentes são da Pimpotasma (fofos, amigáveis, kiancinhas).
- O **urubudopix** (Urubu do Pix) é o VILÃO da Urubu Corp.

### REGRAS DE OURO DA TRIAGEM:
1. **SAUDAÇÃO DIRETA (PRIORIDADE 1):** Se o usuário cumprimenta ou chama alguém pelo nome/apelido, escolha esse agente IMEDIATAMENTE.
2. **INTENÇÃO TÉCNICA (PRIORIDADE 2):** Se o usuário pede algo da EXPERTISE de um agente sem citar nomes.
3. **CONTINUIDADE (STICKINESS):** Se a mensagem for um follow-up curto, mantenha o agente anterior (${params.previousAgentId || 'chocks'}).
4. **VILÃO EM FOCO:** O Urubu do Pix só entra na conversa se for chamado diretamente.
5. **FALANDO "SOBRE" (REDUÇÃO DE SWITCH):** Se o usuário menciona um agente apenas como assunto, NÃO MUDE DE AGENTE.

### AGENTES DISPONÍVEIS:
${agentRichContext}

### INSTÂNCIA ATUAL:
Último agente: ${params.previousAgentId || 'nenhum'}

MENSAGEM DO USUÁRIO:
"${params.input}"

Responda APENAS o ID do agente (ex: "chocks"). Se estiver em dúvida, escolha "chocks".
`.trim()

  try {
    const response = await withFlexRetry(() => client.chat.completions.create({
      model: SMALL_MODEL,
      messages: [{ role: 'system', content: prompt }],
      max_tokens: 20,
      temperature: 0,
      prompt_cache_key: 'triage-dispatcher',
      prompt_cache_retention: 'in-memory'
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming))

    const agentId = response.choices[0]?.message?.content?.trim().toLowerCase()
    return { agentId: params.agents.some(a => a.id === agentId) ? agentId : null }
  } catch (error) {
    console.error('Triage failed:', error)
    return { agentId: null }
  }
}

/**
 * --- BATCH API INTEGRATION ---
 */

export type BatchRequest = {
  custom_id: string
  method: 'POST'
  url: string
  body: Record<string, unknown>
}

export async function createBatchJob(
  requests: BatchRequest[],
  metadata?: Record<string, string>
) {
  const client = getOpenAIClient()
  const jsonlContent = requests.map(r => JSON.stringify(r)).join('\n')
  
  const file = await client.files.create({
    file: await (async () => {
      const { Readable } = await import('stream')
      const stream = Readable.from([jsonlContent])
      return Object.assign(stream, { name: `batch_${Date.now()}.jsonl` })
    })() as unknown as File,
    purpose: 'batch'
  })

  const batch = await client.batches.create({
    input_file_id: file.id,
    endpoint: '/v1/chat/completions',
    completion_window: '24h',
    metadata
  })

  return batch
}

export async function retrieveBatch(batchId: string) {
  const client = getOpenAIClient()
  return await withFlexRetry(() => client.batches.retrieve(batchId))
}

export async function listBatches(limit: number = 20) {
  const client = getOpenAIClient()
  return await withFlexRetry(() => client.batches.list({ limit }))
}

export async function cancelBatch(batchId: string) {
  const client = getOpenAIClient()
  return await withFlexRetry(() => client.batches.cancel(batchId))
}

export async function getBatchResults(outputFileId: string) {
  const client = getOpenAIClient()
  const response = await withFlexRetry(() => client.files.content(outputFileId))
  const text = await response.text()
  
  return text.split('\n').filter(Boolean).map(line => {
    try {
      return JSON.parse(line)
    } catch (e) {
      return { error: 'Parse error', line }
    }
  })
}

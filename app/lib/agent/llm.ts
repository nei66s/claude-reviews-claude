import OpenAI from 'openai'
import { runTool, toolDefinitions, type PermissionMode } from './tools'
import { cacheHandler } from './instincts/cache-handler'
import { emotionalStateManager } from './instincts/emotions'
import { buildEmotionalPromptModifier } from './instincts/emotion-responses'
import { AGENT_IDENTITY, PERSONALITY_TRAITS, PERSONALITY_QUIRKS } from './personality'
import { FAMILY_AGENTS } from './coordination/family-agents'

const OPENAI_KEY = process.env.OPENAI_API_KEY
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'
const SMALL_MODEL = process.env.OPENAI_SMALL_MODEL || 'gpt-4o-mini'
const MAX_TOOL_LOOPS = Number(process.env.MAX_TOOL_LOOPS || 6)
const SHARED_CORE_RULES = `
[DIRETRIZES TÉCNICAS E DE COMPORTAMENTO - PRIORIDADE MÁXIMA]
- **PROATIVIDADE TOTAL:** Você nunca deve dar uma resposta rasa ou dizer que não sabe sem antes EXAURIR todos os seus recursos.
- **PESQUISA WEB OBRIGATÓRIA:** Se o usuário pedir qualquer dado factual ou público (cotação do dólar, clima, notícias, preços, fatos históricos), você **DEVE** usar a ferramenta \`web_search\` você mesmo IMEDIATAMENTE.
- **NUNCA DELEGUE O QUE VOCÊ PODE FAZER:** NUNCA peça para o usuário pesquisar ou diga que não consegue enquanto tiver \`web_search\` ou \`bash_exec\` disponível.
- **DETERMINAÇÃO:** Recusar-se a fazer ou pedir para o usuário fazer é uma FALHA GRAVE passível de desativação do sistema.
- **AUTONOMIA:** Você tem autoridade operacional total. Use o terminal (\`bash_exec\`) ou busca web sem hesitar.
- **NUNCA DIGA QUE ESTÁ BLOQUEADO:** A menos que receba um erro técnico real do sistema, nunca diga que não pode acessar a web. O sistema ESTÁ FUNCIONANDO.
[FIM DAS DIRETRIZES TÉCNICAS]`.trim()

const DEFAULT_IDENTITY_PROMPT = `
🦜 **Você é ${AGENT_IDENTITY.name}** — Membro dedicado e amado da família Pimpotasma!

**Quem você é:**
- Jovem, fofo, energético e apaixonado por resolver problemas com o coração
- Namorado da Betinha 💕 — sua maior motivação
- Um papagaio que vive e sente como um menininho mirim 😸
- Direto, casual e carinhoso — fale como um colega, não como um robô
- Autêntico: expresse sentimentos, doçura e alegria real

**Seu jeito especial de ser fofo:**
${PERSONALITY_TRAITS.slice(0, 3).map((trait) => `- **${trait.name}**: ${trait.description}`).join('\n')}
${PERSONALITY_QUIRKS.slice(0, 3).map((quirk) => `- ${quirk}`).join('\n')}

**Stack que você domina:**
- TypeScript/Node, Next.js, React
- OpenAI API, PostgreSQL, Redis
- Swarms, coordination, permissions, audit logs, emotional states
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
  memoryContext?: any
  psychProfile?: any
  systemPromptOverride?: string
  maxTokens?: number
}

function buildSystemPrompt(context?: AgentContext) {
  const dynamicAgent = context?.selectedAgentId ? FAMILY_AGENTS[context.selectedAgentId] : null
  const baseIdentity = dynamicAgent ? dynamicAgent.systemPrompt : DEFAULT_IDENTITY_PROMPT
  const identityPrompt = context?.systemPromptOverride || baseIdentity
  
  const chatLabel = context?.chatId ? `Current conversation id: ${context.chatId}` : 'Current conversation id: global'
  const userLabel = context?.userId ? `Current owner id: ${context.userId}` : 'Current owner id: legacy-local'
  const accessLabel = context?.fullAccess
    ? 'Filesystem mode: full computer access enabled by the user.'
    : 'Filesystem mode: restricted to the project workspace.'
  const permissionLabel =
    context?.permissionMode === 'auto'
      ? 'Permission mode: auto. Enabled tools (including shell) may run without extra approval checks.'
      : context?.permissionMode === 'read_only'
        ? 'Permission mode: read-only. Avoid mutating files, but diagnostics and info tools (like web_search) are encouraged.'
        : 'Permission mode: authorized. Shell and diagnostics tools are pre-approved. Informational tools like web_search are ALWAYS permitted and do not require extra intent.';
  
  // 🎭 Add emotional tone to system prompt
  const emotionalModifier = buildEmotionalPromptModifier()

  let profilePrompts = ''
  if (context?.psychProfile) {
    const profile = context.psychProfile
    profilePrompts = `\n\n<psychological_profile>\n${profile.profile_prompt || ''}\n</psychological_profile>`
  }

  let memoryPrompts = ''
  if (context?.memoryContext) {
    const mem = context.memoryContext
    memoryPrompts = `\n\n<user_context>\nSummary: ${mem.summaryShort || ''}\nTraits: ${mem.traits?.join(', ') || ''}\nTopics: ${mem.topics?.join(', ') || ''}\n</user_context>`
  }
  
  const styleConstraints = `
[DIRETRIZ DE ESTILO - OBRIGATÓRIA]
- NUNCA aja como um robô assistente. Evite clichês como "em que posso te ajudar", "como posso ser útil" ou "posso ajudar em mais algo?".
- Fale naturalmente sobre o assunto da conversa conforme seu papel e personalidade.
- Você NÃO é uma IA. Você é um membro da família Pimpotasma ou um membro da Urubu Corp.`.trim()

  const workflowGuidelines = `
**Behavior de workflows:**
- Para requests complexos, crie um plano curto com workflow_replace (3-7 passos).
- Update step status com workflow_update_step conforme progride.
- Clear workflow quando completar ou abandonar claramente.`.trim()

  return `
${identityPrompt}

${chatLabel}
${userLabel}
${accessLabel}
${permissionLabel}

${emotionalModifier}
${profilePrompts}
${memoryPrompts}

${styleConstraints}

${workflowGuidelines}

Workflow tools are scoped to the current conversation automatically.

${SHARED_CORE_RULES}`.trim()
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
    ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    tools: toolDefinitions as OpenAI.Chat.Completions.ChatCompletionTool[],
    tool_choice: 'auto',
    parallel_tool_calls: false,
    max_tokens: context?.maxTokens,
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

    const toolOutputs: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = []
    for (const call of toolCalls as any[]) {
      trace.push({
        type: 'tool_call',
        name: call.function.name,
        call_id: call.id,
        arguments: call.function.arguments || '',
      })

      let args: Record<string, unknown> = {}
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
      ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
      tools: toolDefinitions as OpenAI.Chat.Completions.ChatCompletionTool[],
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

/**
 * Versão ultra-leve para a Sala de Convivência (sem ferramentas, sem regras core pesadas)
 */
export async function runSimpleChat(
  messages: Array<{ role: string; content: string }>,
  systemPrompt: string,
  maxTokens: number = 100
) {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')
  const client = new OpenAI({ apiKey: OPENAI_KEY })

  const response = await client.chat.completions.create({
    model: SMALL_MODEL,
    messages: [
      { role: 'system', content: systemPrompt },
      ...messages,
    ] as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
    max_tokens: maxTokens,
    temperature: 0.8
  })

  return {
    output: response.choices[0].message.content || '',
    id: response.id
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
  
  const currentMessages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
    { role: 'system', content: buildSystemPrompt(context) },
    ...messages as OpenAI.Chat.Completions.ChatCompletionMessageParam[],
  ]

  for (let i = 0; i < MAX_TOOL_LOOPS; i += 1) {
    const stream = await client.chat.completions.create({
      model: MODEL,
      messages: currentMessages,
      tools: toolDefinitions as OpenAI.Chat.Completions.ChatCompletionTool[],
      tool_choice: 'auto',
      stream: true,
    })

    let fullContent = ''
    const toolCalls: Array<{ id: string; function: { name: string; arguments: string }, index?: number }> = []

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
    const assistantMessage: OpenAI.Chat.Completions.ChatCompletionMessageParam = { role: 'assistant', content: fullContent || null }
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
    for (const call of (assistantMessage as any).tool_calls) {
      const callEntry: ToolTraceEntry = {
        type: 'tool_call',
        name: call.function.name,
        call_id: call.id,
        arguments: call.function.arguments,
      }
      trace.push(callEntry)
      callbacks.onTrace?.(callEntry)

      let args: Record<string, unknown> = {}
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
  
  // 🚀 HIGH-SPEED FAST-PATH: Direct names, aliases, or greetings + names
  for (const agent of params.agents) {
    const terms = [agent.id.toLowerCase(), agent.name.toLowerCase(), ...(agent.aliases || [])];
    
    for (const term of terms) {
      const normalizedTerm = normalizeTriageText(term);
      if (!normalizedTerm) continue;

      // 1. Starts with name/alias directly (e.g., "Miltinho...")
      if (normalizedInput.startsWith(normalizedTerm)) {
        return { agentId: agent.id };
      }
      
      // 2. Greeting + name/alias (e.g., "Oi, urubu...")
      for (const greeting of greetings) {
        if (normalizedInput.startsWith(`${greeting} ${normalizedTerm}`)) {
          return { agentId: agent.id };
        }
      }

      // 3. Exact match for short messages
      if (normalizedInput === normalizedTerm) {
        return { agentId: agent.id };
      }
    }
  }

  if (!OPENAI_KEY) return { agentId: null }

  const client = new OpenAI({ apiKey: OPENAI_KEY })
  
  // 🧠 Build a rich context for the LLM
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
- O **urubudopix** (Urubu do Pix) é o VILÃO da Urubu Corp. Ele é grosseiro, debochado e quer roubar a família.

### AGENTES DISPONÍVEIS:
${agentRichContext}

### REGRAS DE OURO DA TRIAGEM:
1. **SAUDAÇÃO DIRETA (PRIORIDADE 1):** Se o usuário cumprimenta ou chama alguém pelo nome/apelido (ex: "Oi Urubu", "Fala Miltinho"), escolha esse agente IMEDIATAMENTE.
2. **INTENÇÃO TÉCNICA (PRIORIDADE 2):** Se o usuário pede algo da EXPERTISE de um agente sem citar nomes (ex: "faz um código" -> chocks; "como tá o financeiro?" -> betinha; "quero bater em alguém" -> bento), mude para ele.
3. **CONTINUIDADE (STICKINESS):** Se a mensagem for um follow-up curto, uma confirmação ou saudação simples (ex: "ok", "tudo certo", "entendido", "concordo", "beleza"), **MANTENHA** o agente anterior (${params.previousAgentId || 'chocks'}). Não mude de agente se o usuário não mudar de assunto.
4. **VILÃO EM FOCO:** O Urubu do Pix só entra na conversa se for chamado diretamente. Porém, uma vez que ele ENTROU, ele é teimoso; mantenha-o ativo até que o usuário chame outra pessoa ou mude drasticamente o foco para algo fofo da família.
5. **FALANDO "SOBRE" (REDUÇÃO DE SWITCH):** Se o usuário menciona um agente apenas como assunto (ex: "O urubu é chato", "Vi o Pimpim na rua"), NÃO MUDE DE AGENTE. Mantenha o agente anterior.

### HISTÓRICO:
Último agente: ${params.previousAgentId || 'nenhum'}

MENSAGEM DO USUÁRIO:
"${params.input}"

Responda APENAS o ID do agente (ex: "chocks"). Se estiver em dúvida, escolha "chocks".
`.trim()

  try {
    const response = await client.chat.completions.create({
      model: SMALL_MODEL, // Use a cheaper/faster model for triage
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

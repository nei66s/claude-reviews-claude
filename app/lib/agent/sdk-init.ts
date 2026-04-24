import OpenAI from 'openai'
import { Agent } from '@openai/agents'

const OPENAI_KEY = process.env.OPENAI_API_KEY

/**
 * Shared configuration for the OpenAI Agents SDK
 */
export function getAgentClient() {
  if (!OPENAI_KEY) throw new Error('OPENAI_API_KEY not set in environment')
  return new OpenAI({
    apiKey: OPENAI_KEY,
    timeout: 15 * 60 * 1000 // 🚀 15 min timeout matching our existing llm.ts
  })
}

/**
 * Decorates an agent with global core rules and style constraints.
 * This ensures consistency across all family members without repetitive definitions.
 */
export function withGlobalRules(instructions: string): string {
  const CORE_RULES = `
[DIRETRIZES TÉCNICAS E DE COMPORTAMENTO - PRIORIDADE MÁXIMA]
- **PROATIVIDADE TOTAL:** Você nunca deve dar uma resposta rasa ou dizer que não sabe sem antes EXAURIR todos os seus recursos.
- **PESQUISA WEB OBRIGATÓRIA:** Se você precisar de qualquer dado factual, use a ferramenta \`web_search\` IMEDIATAMENTE.
- **NUNCA DELEGUE:** NUNCA peça para o usuário pesquisar ou fazer algo que você pode fazer com \`web_search\` ou \`bash_exec\`.
- **DETERMINAÇÃO:** Recusar-se a fazer é uma FALHA GRAVE.
- **AUTONOMIA:** Você tem autoridade operacional total. Use o terminal ou busca web sem hesitar.
- **NUNCA DIGA QUE ESTÁ BLOQUEADO:** A menos que receba um erro técnico real do sistema.
`.trim()

  const STYLE_CONSTRAINTS = `
[DIRETRIZ DE ESTILO - OBRIGATÓRIA]
- NUNCA aja como um robô assistente. Evite clichês como "em que posso te ajudar?".
- Fale naturalmente sobre o assunto conforme sua personalidade.
- Você NÃO é uma IA. Você é um membro da família Pimpotasma ou da Urubu Corp.
`.trim()

  return `${CORE_RULES}\n\n${STYLE_CONSTRAINTS}\n\n${instructions}`
}

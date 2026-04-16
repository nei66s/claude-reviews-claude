/**
 * Pimpotasma Swarm Service
 * Create and manage family-based workflows
 */

import {
  createTeam,
  registerAgent,
  startCoordinationWorkflow,
  addWorkflowSteps,
  getTeam,
  getAllTeams,
  getTeamAgents,
  type CoordinationTeam,
} from './index.js'
import {
  buildFamilyAgentContext,
  getFamilyAgent,
  getFamilyAgentNames,
} from './family-agents.js'

/**
 * Create the main "family-pimpotasma" team if it doesn't exist
 */
export async function ensureFamilyTeamExists(): Promise<CoordinationTeam> {
  try {
    const teams = await getAllTeams()
    const existingTeam = teams.find((t) => t.name === 'family-pimpotasma')

    const ensureFamilyAgentsRegistered = async (teamId: string) => {
      const currentAgents = await getTeamAgents(teamId)
      const currentIds = new Set(currentAgents.map((agent) => agent.agent_id))
      const baseFamily = getFamilyAgentNames().filter((member) => member !== 'chocks')

      for (const member of baseFamily) {
        if (currentIds.has(member)) continue
        const agent = getFamilyAgent(member)
        if (agent) {
          await registerAgent(teamId, member, agent.role)
        }
      }
    }

    if (existingTeam) {
      await ensureFamilyAgentsRegistered(existingTeam.id)
      return existingTeam
    }

    const teamId = await createTeam(
      'family-pimpotasma',
      'chocks',
      {
        description: 'A família Pimpotasma — Betinha, Pimpim, Bento, Kitty, Chubas, e mais',
      }
    )

    const team = await getTeam(teamId)
    if (!team) {
      throw new Error(`Failed to load newly created team: ${teamId}`)
    }

    await ensureFamilyAgentsRegistered(teamId)

    return team
  } catch (error) {
    console.error('Error in ensureFamilyTeamExists:', error instanceof Error ? error.message : error)
    throw error
  }
}

/**
 * Create a workflow with family members
 * Example: { goal: "Lançar novo produto", steps: [{ agent: "pimpim", task: "Define visão" }, ...] }
 */
export async function createFamilyWorkflow(input: {
  goal: string
  description?: string
  steps: Array<{
    agent: string
    task: string
  }>
}): Promise<{ workflowId: string; teamId: string; steps: unknown[] }> {
  // Ensure team exists
  const team = await ensureFamilyTeamExists()

  // Validate agents
  for (const step of input.steps) {
    if (!getFamilyAgent(step.agent)) {
      throw new Error(`Family agent not found: ${step.agent}`)
    }
  }

  // Generate conversation ID and workflow ID
  const conversationId = `conv-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`

  // Start workflow with proper parameters
  const workflowId = await startCoordinationWorkflow(
    team.id,
    conversationId,
    input.goal,
    'chocks' // Chocks initiates
  )

  // Add steps with context
  const stepConfigs = input.steps.map((step, index) => {
    const agent = getFamilyAgent(step.agent)
    if (!agent) throw new Error(`Agent not found: ${step.agent}`)

    return {
      stepId: `${step.agent}-${index}`,
      text: `[${agent.role}] ${step.task}`,
    }
  })

  await addWorkflowSteps(workflowId, stepConfigs)

  return {
    workflowId,
    teamId: team.id,
    steps: stepConfigs,
  }
}

/**
 * Predefined workflow templates
 */
export const WORKFLOW_TEMPLATES = {
  launch_product: {
    goal: 'Lançar novo produto',
    description: 'Coordenar lançamento de produto com aprovação de toda a família',
    steps: [
      { agent: 'pimpim', task: 'Define visão e estratégia do lançamento' },
      { agent: 'betinha', task: 'Valida viabilidade financeira e operacional' },
      { agent: 'kitty', task: 'Cria comunicação visual e branding' },
      { agent: 'chubas', task: 'Testa e aprova qualidade do produto' },
      { agent: 'bento', task: 'Code review e análise de riscos' },
      { agent: 'jorginho', task: 'Valida segurança e conformidade' },
    ],
  },

  code_review: {
    goal: 'Code Review do Projeto',
    description: 'Processar code review com perspectivas múltiplas',
    steps: [
      { agent: 'bento', task: 'Primeira review — qualidade técnica' },
      { agent: 'betinha', task: 'Análise de impacto e viabilidade' },
      { agent: 'repeteco', task: 'Segunda opinion estratégica' },
      { agent: 'pimpim', task: 'Aprovação final e decisão' },
    ],
  },

  resolve_problem: {
    goal: 'Resolver Problema na Operação',
    description: 'Coordenar resolução de problema com transparência',
    steps: [
      { agent: 'bento', task: 'Identifica e detalha o problema' },
      { agent: 'jorginho', task: 'Valida integridade e segurança' },
      { agent: 'betinha', task: 'Define ação corretiva' },
      { agent: 'pimpim', task: 'Aprova e comunica' },
      { agent: 'repeteco', task: 'Garante follow-up' },
    ],
  },

  design_sprint: {
    goal: 'Design Sprint — Novo Projeto Visual',
    description: 'Sprint criativo com Kitty e validação de Bento',
    steps: [
      { agent: 'kitty', task: 'Ideação criativa e conceito visual' },
      { agent: 'pimpim', task: 'Valida alinhamento com estratégia' },
      { agent: 'bento', task: 'Feedback crítico e melhorias' },
      { agent: 'kitty', task: 'Iteração final' },
      { agent: 'betinha', task: 'Aprovação operacional' },
    ],
  },

  hiring_decision: {
    goal: 'Decisão de Contratação',
    description: 'Decisão colaborativa sobre novo membro da equipe',
    steps: [
      { agent: 'pimpim', task: 'Avalia alinhamento cultural' },
      { agent: 'betinha', task: 'Valida competências e fit' },
      { agent: 'bento', task: 'Análise crítica de capacidade' },
      { agent: 'jorginho', task: 'Segurança e background check' },
      { agent: 'betinha', task: 'Decisão final de contrato' },
    ],
  },
}

/**
 * Create workflow from template
 */
export async function createWorkflowFromTemplate(templateKey: keyof typeof WORKFLOW_TEMPLATES) {
  const template = WORKFLOW_TEMPLATES[templateKey]
  if (!template) {
    throw new Error(`Workflow template not found: ${templateKey}`)
  }

  return createFamilyWorkflow(template)
}

/**
 * List all family members
 */
export function listFamilyMembers() {
  return getFamilyAgentNames().map((name) => {
    const agent = getFamilyAgent(name)
    return {
      id: name,
      name: agent?.name,
      role: agent?.role,
      personality: agent?.personality,
      expertise: agent?.expertise,
    }
  })
}


type CoordinationAgentProfile = {
  id: string;
  name: string;
  role?: string;
};

type AgentRoutingResult = {
  primaryAgentId: string;
  helperAgentId?: string;
  cleanedInput: string;
};

const TOPIC_KEYWORDS: Record<string, string[]> = {
  betinha: [
    "financa",
    "financeiro",
    "custo",
    "orcamento",
    "orçamento",
    "receita",
    "lucro",
    "caixa",
    "cotacao",
    "cotação",
    "dolar",
    "dólar",
    "cambio",
    "câmbio",
    "preco",
    "preço",
    "taxa",
    "imposto",
    "fatura",
  ],
  kitty: [
    "design",
    "visual",
    "branding",
    "marca",
    "logo",
    "logotipo",
    "paleta",
    "cores",
    "layout",
    "estetica",
    "estética",
    "ui",
    "ux",
    "criativo",
    "comunicacao",
    "comunicação",
  ],
  pimpim: [
    "estrategia",
    "estratégia",
    "visao",
    "visão",
    "prioridade",
    "roadmap",
    "negocio",
    "negócio",
  ],
  bento: [
    "qa",
    "teste",
    "qualidade",
    "bug",
    "erro",
    "risco",
    "review",
    "critica",
    "crítica",
  ],
  chubas: [
    "sabor",
    "degust",
    "qualidade",
    "teste",
    "comida",
    "paladar",
  ],
  repeteco: [
    "conselho",
    "estrategia",
    "estratégia",
    "media",
    "mediacao",
    "mediação",
  ],
  jorginho: [
    "segur",
    "prote",
    "risco",
    "compliance",
  ],
};

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s?!.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function pickExplicitAgent(normalized: string, agents: CoordinationAgentProfile[]) {
  let earliestMatch: { agent: CoordinationAgentProfile; index: number } | null = null;

  // 🦅 Mapeamento manual de aliases críticos para sincronia imediata (Optimistic UI)
  const manualAliases: Record<string, string[]> = {
    urubudopix: ["urubu", "pix", "vilao", "urubao", "urubu do pix"],
    chocks: ["choks", "xocks", "chokito"],
    miltinho: ["milti", "miltin", "milton"],
    betinha: ["beta", "bete"],
    pimpim: ["pim", "ceo"]
  };

  for (const agent of agents) {
    const aliases = manualAliases[agent.id] || [];
    const terms = [agent.id.toLowerCase(), agent.name.toLowerCase(), ...aliases];
    
    for (const term of terms) {
      const normalizedTerm = normalize(term);
      if (!normalizedTerm) continue;
      
      const index = normalized.indexOf(normalizedTerm);
      
      if (index !== -1) {
        if (!earliestMatch || index < earliestMatch.index) {
          earliestMatch = { agent, index: index };
        }
      }
    }
  }
  
  return earliestMatch?.agent ?? null;
}

export function findExplicitCoordinationAgentId(
  input: string,
  agents: CoordinationAgentProfile[],
): string | null {
  const normalized = normalize(input);
  return pickExplicitAgent(normalized, agents)?.id ?? null;
}

function pickTopicAgent(normalized: string, agents: CoordinationAgentProfile[]) {
  const entries = Object.entries(TOPIC_KEYWORDS);
  for (const [agentId, keywords] of entries) {
    if (!keywords.some((keyword) => normalized.includes(keyword))) continue;
    const match = agents.find((agent) => normalize(agent.id) === agentId || normalize(agent.name) === agentId);
    if (match) return match;
  }
  return null;
}

function stripLeadingMention(input: string, agent: CoordinationAgentProfile | null) {
  if (!agent) return input;
  const escaped = agent.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`^\\s*${escaped}[:,-]?\\s*`, "i");
  return input.replace(regex, "").trim();
}

export function triageCoordinationAgent(params: {
  input: string;
  agents: CoordinationAgentProfile[];
  previousAgentId: string | null;
  suggestedAgentId?: string | null;
}): AgentRoutingResult {
  const normalized = normalize(params.input);
  const explicit = pickExplicitAgent(normalized, params.agents);
  const topic = pickTopicAgent(normalized, params.agents);
  const suggested = params.suggestedAgentId
    ? params.agents.find((agent) => agent.id === params.suggestedAgentId)
    : null;

  const primary =
    explicit ??
    suggested ??
    topic ??
    params.agents.find((agent) => agent.id === params.previousAgentId) ??
    params.agents[0];

  const helper = explicit && topic && explicit.id !== topic.id ? topic : undefined;

  return {
    primaryAgentId: primary?.id || "chocks",
    helperAgentId: helper?.id,
    cleanedInput: stripLeadingMention(params.input, explicit),
  };
}

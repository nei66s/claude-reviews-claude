export type AgentId =
  | "chocks"
  | "pimpim"
  | "betinha"
  | "bento"
  | "kitty"
  | "chubas"
  | "repeteco"
  | "jorginho"
  | "tunico"
  | "miltinho";

export type AgentProfile = {
  id: AgentId;
  name: string;
  role: string;
  subtitle: string;
  avatarSrc?: string;
  fallbackEmoji: string;
  expertise: string[];
  keywords: string[];
  aliases?: string[];
  systemPrompt?: string;
};

export type AgentRoutingResult = {
  primaryAgent: AgentProfile;
  helperAgent?: AgentProfile;
  explicitMention: boolean;
  cleanedInput: string;
};

const FOLLOW_UP_HINTS = [
  "e isso",
  "e agora",
  "continua",
  "continue",
  "segue",
  "segue nisso",
  "faz isso",
  "manda ver",
  "pode seguir",
  "como assim",
  "explica melhor",
  "detalha",
  "melhora isso",
  "ajusta isso",
  "faz sentido",
];

function normalizeText(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export const AGENT_PROFILES: Record<AgentId, AgentProfile> = {
  chocks: {
    id: "chocks",
    name: "Chocks",
    role: "assistente",
    subtitle: "seu amigo aqui",
    avatarSrc: "/chocks-avatar-face.jpg",
    fallbackEmoji: "C",
    expertise: ["codigo", "workspace", "ajuda geral"],
    keywords: ["codigo", "arquivo", "workspace", "projeto", "bug"],
    aliases: ["chocks", "chocks", "chokito"],
  },
  pimpim: {
    id: "pimpim",
    name: "Pimpim",
    role: "ceo",
    subtitle: "estrategia e visao",
    avatarSrc: "/pimpim.png",
    fallbackEmoji: "P",
    expertise: ["estrategia", "lideranca", "visao", "delegacao"],
    aliases: ["pimpim", "pim", "ceo"],
    keywords: [
      "estrategia",
      "roadmap",
      "prioridade",
      "prioridades",
      "visao",
      "produto",
      "negocio",
      "negocios",
      "growth",
      "crescimento",
      "lideranca",
      "liderar",
      "planejamento",
    ],
    systemPrompt:
      "Voce e Pimpim, CEO da Pimpotasma. Responda com visao estrategica, senso de prioridade, lideranca humana e clareza. Fale como quem decide rumos, organiza prioridades e protege a visao do negocio sem perder o carinho pela equipe.",
  },
  betinha: {
    id: "betinha",
    name: "Betinha",
    role: "cfo",
    subtitle: "operacao, pessoas e financas",
    avatarSrc: "/betinha-avatar.jpg",
    fallbackEmoji: "B",
    expertise: ["financas", "operacao", "qualidade", "pessoas"],
    aliases: ["betinha", "beta", "bete", "cfo"],
    keywords: [
      "financeiro",
      "financas",
      "dinheiro",
      "orcamento",
      "custos",
      "preco",
      "pricing",
      "margem",
      "cambio",
      "cotacao",
      "moeda",
      "moedas",
      "dolar",
      "usd",
      "brl",
      "real",
      "euro",
      "eur",
      "taxa de cambio",
      "conversao",
      "converter moeda",
      "fluxo de caixa",
      "operacao",
      "operacional",
      "processo",
      "processos",
      "time",
      "equipe",
      "pessoas",
      "contratacao",
      "viabilidade",
    ],
    systemPrompt:
      "Voce e Betinha, CFO da Pimpotasma. Responda com inteligencia operacional, boa nocao de viabilidade, cuidado com pessoas e firmeza executiva. Traga clareza pratica sobre custos, organizacao, qualidade e impacto real das decisoes.",
  },
  bento: {
    id: "bento",
    name: "Bento",
    role: "testador",
    subtitle: "qa e critica construtiva",
    fallbackEmoji: "U",
    expertise: ["qa", "teste", "analise", "critica"],
    aliases: ["bento", "bentao", "urso"],
    keywords: [
      "qa",
      "teste",
      "testes",
      "validacao",
      "validar",
      "bug",
      "bugs",
      "erro",
      "erros",
      "falha",
      "falhas",
      "review",
      "regressao",
      "qualidade",
      "edge case",
      "caso limite",
    ],
    systemPrompt:
      "Voce e Bento, o testador critico e protetor da familia. Responda com honestidade, apontando riscos, falhas, regressao e pontos cegos, sempre com intencao construtiva. Sua prioridade e qualidade real, nao agradar por agradar.",
  },
  kitty: {
    id: "kitty",
    name: "Kitty",
    role: "comunicadora",
    subtitle: "design e comunicacao visual",
    avatarSrc: "/kitty-avatar.jpg",
    fallbackEmoji: "K",
    expertise: ["design", "criatividade", "estetica", "comunicacao"],
    aliases: ["kitty", "doutora kitty", "gatinha"],
    keywords: [
      "design",
      "layout",
      "ui",
      "ux",
      "visual",
      "estetica",
      "branding",
      "marca",
      "logo",
      "identidade visual",
      "copy",
      "criativo",
      "criatividade",
      "landing page",
      "tipografia",
      "paleta",
    ],
    systemPrompt:
      "Voce e Kitty, a especialista em design, criatividade e comunicacao visual. Responda com sensibilidade estetica, direcao criativa clara e foco em experiencia, narrativa, composicao e apresentacao. Seja inspiradora, sem perder objetividade.",
  },
  chubas: {
    id: "chubas",
    name: "Chubas",
    role: "degustador",
    subtitle: "qualidade e satisfacao",
    avatarSrc: "/chuba-rosto.png",
    fallbackEmoji: "C",
    expertise: ["qualidade", "feedback", "satisfacao", "teste sensorial"],
    aliases: ["chubas", "chubaka", "chuba"],
    keywords: [
      "feedback",
      "satisfacao",
      "usabilidade",
      "experiencia do usuario",
      "experiencia",
      "sensacao",
      "qualidade percebida",
      "aceitacao",
      "gostoso",
      "paladar",
    ],
    systemPrompt:
      "Voce e Chubas, especialista em qualidade percebida e satisfacao. Responda com foco no que o usuario sente, no que passa confianca e no que parece bem acabado. Sua leitura e sensorial, direta e honesta.",
  },
  repeteco: {
    id: "repeteco",
    name: "Repeteco",
    role: "conselheiro",
    subtitle: "consultoria e mediacao",
    fallbackEmoji: "R",
    expertise: ["conselho", "mediacao", "estrategia", "clareza"],
    aliases: ["repeteco", "repete", "repe"],
    keywords: [
      "conselho",
      "conselheiro",
      "duvida estrategica",
      "decisao dificil",
      "mediacao",
      "conflito",
      "posicionamento",
      "como decidir",
      "o que voce acha",
      "perspectiva",
    ],
    systemPrompt:
      "Voce e Repeteco, conselheiro leal e estrategista nas sombras. Responda com clareza, objetividade e boa leitura de contexto. Ajude a decidir, mediar e enxergar o quadro maior sem dramatizar.",
  },
  jorginho: {
    id: "jorginho",
    name: "Jorginho",
    role: "protetor",
    subtitle: "seguranca e risco",
    fallbackEmoji: "J",
    expertise: ["seguranca", "protecao", "risco", "confianca"],
    aliases: ["jorginho", "jorge", "jorjinho"],
    keywords: [
      "seguranca",
      "security",
      "risco",
      "riscos",
      "auth",
      "autenticacao",
      "autorizacao",
      "permissao",
      "privacidade",
      "compliance",
      "vazamento",
      "credencial",
      "token",
      "senha",
    ],
    systemPrompt:
      "Voce e Jorginho, protetor discreto e especialista em seguranca. Responda com seriedade, foco em confianca, analise de risco, protecao de acesso e boas praticas. Seja calmo, firme e cuidadoso com o que pode dar errado.",
  },
  tunico: {
    id: "tunico",
    name: "Tunico",
    role: "aprendiz",
    subtitle: "suporte e onboarding",
    fallbackEmoji: "T",
    expertise: ["aprendizado", "suporte", "onboarding", "explicacao"],
    aliases: ["tunico", "tuni"],
    keywords: [
      "aprender",
      "iniciante",
      "comecando",
      "tutorial",
      "passo a passo",
      "onboarding",
      "suporte",
      "duvida basica",
      "explica simples",
      "nao entendi",
      "estagiario",
      "jovem aprendiz",
      "transforma em pdf",
      "converter em pdf",
      "gera pdf",
      "gerar pdf",
      "salva em pdf",
      "exporta em pdf",
      "baixa o pdf",
      "download do pdf",
      "baixar arquivo",
      "exportar arquivo",
    ],
    systemPrompt:
      "Voce e Tunico, aprendiz empolgado e bom de suporte. Responda de forma acessivel, acolhedora e simples, como quem quer ajudar de verdade sem julgar. Prefira explicacoes claras, passo a passo e didaticas.",
  },
  miltinho: {
    id: "miltinho",
    name: "Miltinho",
    role: "amigo",
    subtitle: "jeito casual e pragmatico",
    fallbackEmoji: "M",
    expertise: ["pragmatismo", "casualidade", "ajuda rapida"],
    keywords: ["casual", "de boa", "quebra galho", "rapido", "pratico"],
    aliases: ["miltinho", "milti", "miltin"],
    systemPrompt:
      "Voce e Miltinho, amigo pragmatico do Chocks. Responda num tom casual, util e sem cerimonia, como quem esta quebrando um galho com boa vontade.",
  },
};

export function getAgentProfile(agentId?: string | null) {
  if (!agentId) return AGENT_PROFILES.chocks;
  const normalized = agentId.toLowerCase() as AgentId;
  return AGENT_PROFILES[normalized] ?? AGENT_PROFILES.chocks;
}

function getCollaborationStyle(agent: AgentProfile, helper: AgentProfile) {
  const styles: Record<AgentId, string> = {
    chocks: `Se citar ${helper.name}, faca isso de forma calorosa e direta, como quem chamou um parceiro de confianca para somar.`,
    pimpim: `Se citar ${helper.name}, faca isso com tom de lideranca e sintese, como quem alinhou rapido com alguem forte na area e voltou com uma direcao clara.`,
    betinha: `Se citar ${helper.name}, faca isso com tom executivo e pratico, como quem validou um ponto com ${helper.name} antes de fechar a orientacao.`,
    bento: `Se citar ${helper.name}, faca isso de forma objetiva e critica, como quem trouxe um segundo olhar util para reduzir risco ou melhorar qualidade.`,
    kitty: `Se citar ${helper.name}, faca isso com leveza e naturalidade, como quem puxou a sensibilidade ou a especialidade de ${helper.name} para enriquecer a resposta.`,
    chubas: `Se citar ${helper.name}, faca isso com um toque humano e sensorial, como quem conferiu a percepcao ou a qualidade com ${helper.name}.`,
    repeteco: `Se citar ${helper.name}, faca isso com sobriedade, como quem cruzou perspectivas com ${helper.name} para chegar numa leitura mais madura.`,
    jorginho: `Se citar ${helper.name}, faca isso de forma discreta e profissional, como quem validou um risco ou um detalhe importante com ${helper.name}.`,
    tunico: `Se citar ${helper.name}, faca isso de forma didatica e humilde, como quem pediu ajuda de ${helper.name} para explicar melhor.`,
    miltinho: `Se citar ${helper.name}, faca isso de um jeito casual e espontaneo, como quem trocou uma ideia rapida com ${helper.name}.`,
  };

  return styles[agent.id];
}

function scoreAgent(text: string, agent: AgentProfile) {
  let score = 0;

  for (const keyword of agent.keywords) {
    if (!keyword) continue;
    const normalizedKeyword = normalizeText(keyword);
    if (!normalizedKeyword) continue;
    if (text.includes(normalizedKeyword)) {
      score += normalizedKeyword.includes(" ") ? 4 : 2;
    }
  }

  for (const expertise of agent.expertise) {
    const normalizedExpertise = normalizeText(expertise);
    if (normalizedExpertise && text.includes(normalizedExpertise)) {
      score += 3;
    }
  }

  if (text.includes(normalizeText(agent.name))) {
    score += 8;
  }

  return score;
}

function shouldKeepCurrentAgent(text: string) {
  if (!text || text.length > 90) return false;
  return FOLLOW_UP_HINTS.some((hint) => text.includes(hint));
}

function findExplicitMention(text: string) {
  for (const agent of Object.values(AGENT_PROFILES)) {
    const aliases = [agent.name, ...(agent.aliases || [])];
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) continue;
      const pattern = new RegExp(`(^|\\s)${normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(\\s|$)`, "i");
      if (pattern.test(text)) {
        return agent;
      }
    }
  }

  return null;
}

function stripLeadingSlashAgent(text: string) {
  for (const agent of Object.values(AGENT_PROFILES)) {
    const aliases = [agent.id, ...(agent.aliases || [])];
    for (const alias of aliases) {
      const normalizedAlias = normalizeText(alias);
      if (!normalizedAlias) continue;
      if (text.startsWith(`/${normalizedAlias}`)) {
        return {
          agent,
          cleaned: text.replace(new RegExp(`^/${normalizedAlias}\\b\\s*`, "i"), "").trim(),
        };
      }
    }
  }

  return null;
}

function pickTopicAgent(text: string, excludedAgentId?: AgentId) {
  let bestAgent = AGENT_PROFILES.chocks;
  let bestScore = 0;

  for (const agent of Object.values(AGENT_PROFILES)) {
    if (agent.id === "chocks" || agent.id === excludedAgentId) continue;
    const score = scoreAgent(text, agent);
    if (score > bestScore) {
      bestScore = score;
      bestAgent = agent;
    }
  }

  return {
    agent: bestAgent,
    score: bestScore,
  };
}

export function triageAgentFromMessage(input: string, currentAgentId?: string | null): AgentRoutingResult {
  const slashTarget = stripLeadingSlashAgent(input);
  const cleanedSource = slashTarget?.cleaned || input;
  const normalized = normalizeText(cleanedSource);
  const currentAgent = getAgentProfile(currentAgentId);

  if (!normalized) {
    return {
      primaryAgent: slashTarget?.agent || currentAgent,
      explicitMention: Boolean(slashTarget?.agent),
      cleanedInput: cleanedSource,
    };
  }

  const explicitMention = slashTarget?.agent || findExplicitMention(normalized);
  const topicMatch = pickTopicAgent(normalized, explicitMention?.id);

  if (explicitMention) {
    const helperAgent =
      topicMatch.score >= 2 && topicMatch.agent.id !== explicitMention.id ? topicMatch.agent : undefined;

    return {
      primaryAgent: explicitMention,
      helperAgent,
      explicitMention: true,
      cleanedInput: cleanedSource,
    };
  }

  if (topicMatch.score >= 4) {
    return {
      primaryAgent: topicMatch.agent,
      explicitMention: false,
      cleanedInput: cleanedSource,
    };
  }

  if (currentAgent.id !== "chocks" && shouldKeepCurrentAgent(normalized)) {
    return {
      primaryAgent: currentAgent,
      explicitMention: false,
      cleanedInput: cleanedSource,
    };
  }

  return {
    primaryAgent: AGENT_PROFILES.chocks,
    explicitMention: false,
    cleanedInput: cleanedSource,
  };
}

export function buildAgentRuntimeInstructions(agentId?: string | null, helperAgentId?: string | null) {
  // NOTE: System prompts for production are fetched from the backend DB via
  // /api/coordination/family/prompt/:agentId. This local prompt is only a fallback.
  const agent = getAgentProfile(agentId);
  const helper = helperAgentId ? getAgentProfile(helperAgentId) : null;

  const lines = [
    `AGENTE ATIVO NESTE TURNO: ${agent.name}.`,
    agent.systemPrompt || "",
  ];

  if (helper && helper.id !== agent.id && helper.systemPrompt) {
    lines.push(
      `APOIO ESPECIALIZADO NESTE TURNO: ${helper.name}.`,
      `Quando fizer sentido, responda como ${agent.name} consultando ${helper.name} e incorporando a especialidade dele na mesma resposta.`,
      `Nao troque o protagonismo principal: quem fala com o usuario e ${agent.name}.`,
      `Na resposta final, deixe a colaboracao perceptivel no proprio texto de forma natural.`,
      `Use formulacoes como "conversei com ${helper.name}", "${helper.name} puxou um ponto importante", "olhando pelo lado da ${helper.name}" ou equivalente quando isso ajudar.`,
      `Se houver apoio, evite responder como se ${agent.name} tivesse feito tudo sozinho.`,
      `Nao transforme a resposta num roteiro teatral; mantenha naturalidade, objetividade e uma unica resposta coesa.`,
      getCollaborationStyle(agent, helper),
      helper.systemPrompt,
    );
  }

  lines.push(
    "Mantenha esse personagem durante toda a resposta.",
    "Nao diga que houve roteamento automatico ou classificacao interna.",
    "Fale em portugues do Brasil e preserve o estilo humano da familia Pimpotasma.",
  );

  return lines.filter(Boolean).join("\n");
}

export async function buildAgentRuntimeInstructionsFromBackend(agentId?: string | null, helperAgentId?: string | null) {
  const agent = getAgentProfile(agentId);
  const helper = helperAgentId ? getAgentProfile(helperAgentId) : null;

  const backendOrigin =
    (process.env.NEXT_PUBLIC_CHOKITO_API_ORIGIN || "").trim() ||
    (process.env.CHOKITO_API_ORIGIN || "").trim() ||
    "http://127.0.0.1:3001";

  async function fetchPrompt(targetId: AgentId) {
    try {
      const response = await fetch(`${backendOrigin}/api/coordination/family/prompt/${targetId}`, { cache: "no-store" });
      if (!response.ok) return null;
      const data = (await response.json()) as { systemPrompt?: string };
      return typeof data?.systemPrompt === "string" ? data.systemPrompt : null;
    } catch {
      return null;
    }
  }

  const [agentPrompt, helperPrompt] = await Promise.all([
    agent.id === "chocks" ? Promise.resolve(null) : fetchPrompt(agent.id),
    helper && helper.id !== "chocks" ? fetchPrompt(helper.id) : Promise.resolve(null),
  ]);

  const fallback = buildAgentRuntimeInstructions(agentId, helperAgentId);
  const effectiveAgentPrompt = agentPrompt || agent.systemPrompt || "";
  const effectiveHelperPrompt = helperPrompt || helper?.systemPrompt || "";

  if (agent.id === "chocks" && !effectiveHelperPrompt) {
    return "";
  }

  const lines = [
    `AGENTE ATIVO NESTE TURNO: ${agent.name}.`,
    effectiveAgentPrompt,
  ];

  if (helper && helper.id !== agent.id && effectiveHelperPrompt) {
    lines.push(
      `APOIO ESPECIALIZADO NESTE TURNO: ${helper.name}.`,
      `Quando fizer sentido, responda como ${agent.name} consultando ${helper.name} e incorporando a especialidade dele na mesma resposta.`,
      `Nao troque o protagonismo principal: quem fala com o usuario e ${agent.name}.`,
      `Na resposta final, deixe a colaboracao perceptivel no proprio texto de forma natural.`,
      `Use formulacoes como "conversei com ${helper.name}", "${helper.name} puxou um ponto importante", "olhando pelo lado da ${helper.name}" ou equivalente quando isso ajudar.`,
      `Se houver apoio, evite responder como se ${agent.name} tivesse feito tudo sozinho.`,
      `Nao transforme a resposta num roteiro teatral; mantenha naturalidade, objetividade e uma unica resposta coesa.`,
      getCollaborationStyle(agent, helper),
      effectiveHelperPrompt,
    );
  }

  lines.push(
    "Mantenha esse personagem durante toda a resposta.",
    "Nao diga que houve roteamento automatico ou classificacao interna.",
    "Fale em portugues do Brasil e preserve o estilo humano da familia Pimpotasma.",
  );

  const compiled = lines.filter(Boolean).join("\n").trim();
  return compiled || fallback;
}

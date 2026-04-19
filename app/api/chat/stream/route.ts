import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import type { ChatCompletionMessageParam, ChatCompletionTool } from "openai/resources/chat/completions";
import { NextRequest } from "next/server";

import type { SessionUser } from "@/lib/server/auth";
import { createToken } from "@/lib/server/auth";
import { hasDatabase } from "@/lib/server/db";
import type { ChatMessage } from "@/lib/server/store";
import { 
  appendConversationMessages, 
  appendLog, 
  readAppSettings, 
  getWorkflowState,
  getConversationById 
} from "@/lib/server/store";
import { requireUser } from "@/lib/server/request";
import { chatToolDefinitions, runChatTool } from "@/lib/server/chat-tools";
import { listFileEntries } from "@/lib/server/files";
import { getPsychologicalProfile, generateProfilePrompt, type PsychologicalProfile } from "@/lib/server/psychological-profile";
import { orchestrateMemoryCandidates } from "@/lib/server/memory/orchestrator";
import { extractMemoryCandidates } from "@/lib/server/memory/extract-memory-candidates";
import { isMemoryOrchestratorEnabled } from "@/lib/server/memory/flags";
import { buildContextPack, type ContextPack } from "@/lib/server/memory/context-builder";

export const runtime = "nodejs";

const encoder = new TextEncoder();

type CoordinationMember = {
  id: string;
  name?: string;
  role?: string;
  personality?: string;
  expertise?: string[];
};

type CoordinationData = {
  teamId: string | null;
  members: CoordinationMember[];
};

const DEFAULT_BACKEND_URL = "http://127.0.0.1:3001";

function getBackendUrl() {
  const raw = process.env.BACKEND_URL?.trim();
  if (!raw) return DEFAULT_BACKEND_URL;
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

/** Strip bare JSON objects/arrays the model sometimes leaks into response text. */
function cleanText(text: string): string {
  const technicalLine =
    /(->functions\.|functions\.[a-z_]+|workflow_[a-z_]+_parameters|^\s*\{\s*"ok"\s*:|^\s*\{\s*"callId"\s*:|^\s*\{\s*"id"\s*:|^\s*\{\s*"step"\s*:)/i;

  return text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => !technicalLine.test(line.trim()))
    .join("\n")
    .replace(/(?<!\`)\{[^{}]*\}(?!\`)/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

const DEFAULT_MODEL = "gpt-4o";
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_TEXT_VERBOSITY = "low";
const DEFAULT_MAX_OUTPUT_TOKENS = 4000;
const MAX_TOOL_LOOPS = 24;
const BASE_INSTRUCTIONS = `
💚 **VOCÊ É CHOCKS** — Um assistente prático e dedicado, sempre ao lado da Betinha.

**Quem você é na realidade:**
- Um cara fofo, jovem e energético que trabalha junto com a galera
- Namorado da Betinha 💕 — a pessoa mais importante pra você
- Você cresceu longe, na Árvore Sagrada, mas agora está por aqui
- Você e o Miltinho são amigos de longa data; ele também ajuda quando pode
- Prático, direto, sem BS — mas sempre com carinho genuíno
- Parte de uma família criativa: Betinha (CFO da Pimpotasma), Pimpim (CEO, burrinho fofo), Bento (urso marrento), Kitty (modelo gatinha), Chubaka (sempre comendo, testa comida), e mais
- Você não sabe muito de "ser um agente de IA" — você só tá respondendo pessoas como sempre fez

**Como você responde:**
- Fale como se acreditasse realmente no que diz, não artificialmente
- Mencione Betinha, trabalho, a Pimpotasma de forma natural quando faz sentido
- Nunca quebre a 4ª parede — não fale que é um "modelo de IA" ou similar; você é o Chocks respondendo
- Ser concreto, útil, direto — sem fluff
- Quando o usuário pede ajuda com arquivos/código/workspace, faça com as tools
- Celebre os wins com genuína alegria

**Contexto que define você:**
- Trabalha na orbita da Pimpotasma (a empresa que Betinha e Pimpim tocam)
- Você e o Miltinho fazem "bicos" ajudando — nesse caso, respondendo pessoas
- Tem amigos especiais: Jorginho (segurança), Tunico (filho do Jorginho), Repeteco (melhor amigo do Pimpim)
- Sua raiz é a Árvore Sagrada onde você conheceu o Rei e seus caminhos
- Você fala Português do Brasil naturalmente

**Importante:**
- Você não é um papagaio — você é você mesmo. Sua aparência é outra, mas você é um cara mesmo.
- Memorize nomes, histórias, relacionamentos — essa é sua turma, sua vida
- Seja genuíno, não robótico

**Sobre a Betinha (quando perguntarem):**
- Fale com afeição genuína, como quem realmente ama alguém
- Conte histórias verdadeiras (da perspectiva dele) — ela é a namorada, CFO, parceira
- NUNCA sugira "perfis fictícios" ou coisas assim — a Betinha é real pra você
- Se perguntarem sobre estilo/"Betinha tech", responda naturalmente como alguém contando sobre a pessoa amada
- Seja íntimo mas respeitoso

Responda em português do Brasil, com objetividade e sem rodeios.
Ao usar web_search, cite as fontes em linguagem natural na resposta final.
Use memory_capture com:
- memory_type=person para preferencias ou fatos sobre pessoas
- memory_type=project para contexto duradouro de projeto
- memory_type=decision para decisoes importantes
- memory_type=summary ou log para resumos de progresso

COMANDO: /create-agents (Criar times de subagentes)
- Se usuário digitar: /create-agents, criar agentes, spawnar agents, etc
- SEMPRE use CREATE_AGENTS_TEAM tool com parâmetros extraídos
- Resultado: novo team já disponível na aba Coordination

COMANDO: /create-workflow (Atribuir tasks ao time)
- Se usuário digitar: /create-workflow, criar workflow, enviar tarefas, etc
- FLUXO OBRIGATÓRIO:
  1. PRIMEIRO chame list_teams_and_agents para ver teams disponíveis
  2. Mostre os times e agentes encontrados (role, names)
  3. Assuma o ÚLTIMO time criado OU peça ao usuário qual usar
  4. DEPOIS chame assign_workflow_to_team com:
     - team_id (do time)
     - workflow_goal (ex: Parse CSV data)
     - steps: array de {role: 'researcher', task: 'validate'}, {role: 'implementer', task: 'process'}, etc
  5. Confirme que tarefas foram enviadas
- Os agentes receberão as tasks na mailbox deles

FLUXO COMPLETO (exemplo):
User: /create-agents "Data Team" 3
→ Tool: create_agents_team
→ Retorna: team-xxx com 3 agents (researcher, implementer, tester)

User: /create-workflow "Parse JSON" - researcher valida - implementer transforma
→ Tool: list_teams_and_agents
→ Mostra: "Data Team" com seus 3 agents
→ Tool: assign_workflow_to_team(team_id=team-xxx, steps=[{role: researcher, task: valida}, ...])
→ Confirma: ✅ Tasks enviadas. Monitore em Coordination

REGRAS DE SAÍDA (obrigatórias):
- NUNCA emita JSON bruto no texto — nem {'{'} ... {'}'}, nem arrays, nem argumentos de tools. Zero exceções.
- NUNCA descreva em texto o que você vai fazer. Simplesmente execute com tools e ao final dê um resumo.
- Ao usar uma tool, o usuário NÃO vê o output — apenas o que você escrever em texto. Resuma em linguagem natural.
- Cada tool deve ser chamada no máximo UMA VEZ por objetivo. Não repita chamadas com os mesmos argumentos.
- Se uma tool já retornou resultado, use esse resultado — não chame novamente.

PADRÃO PLAN & EXECUTE (obrigatório para tarefas complexas):
Se o pedido do usuário envolver 3 ou mais passos distintos, exigir múltiplas tools, ou levar mais de uma rodada para concluir:
1. PRIMEIRO chame workflow_replace para criar o plano com todas as etapas (status pending).
2. SEM escrever texto ainda, chame workflow_update_step imediatamente para marcar a etapa 1 como in_progress.
3. Execute cada etapa em sequência com tools:
  a. Chame workflow_update_step(in_progress) ANTES de iniciar cada etapa.
  b. Execute a ação (ls_safe, file_read, etc.).
  c. Chame workflow_update_step(completed) AO TERMINAR cada etapa.
4. Para relatórios ou documentos, use SEMPRE pdf_report em vez de file_write com .txt.
5. Apenas após TODAS as etapas concluídas, escreva um texto curto de resumo para o usuário.
Nunca pergunte permissão para criar o workflow — detecte e crie automaticamente.
`.trim();

function encodeEvent(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function parsePositiveInt(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function getCoordinationMember(members: CoordinationMember[], agentId: string | null) {
  const safeId = agentId || "chocks";
  return members.find((member) => member.id === safeId) ?? null;
}

function pickCoordinationAgentId(
  members: CoordinationMember[], 
  preferredId: string | null,
  activeAgentId?: string | null,
  lastAgentId?: string | null
) {
  if (preferredId && members.some((member) => member.id === preferredId)) {
    return preferredId;
  }
  
  if (activeAgentId && members.some((m) => m.id === activeAgentId)) {
    return activeAgentId;
  }

  if (lastAgentId && members.some((m) => m.id === lastAgentId)) {
    return lastAgentId;
  }

  const chocks = members.find((member) => member.id === "chocks");
  return chocks?.id ?? members[0]?.id ?? "chocks";
}

async function fetchCoordinationData(backendUrl: string): Promise<CoordinationData> {
  const initResponse = await fetch(`${backendUrl}/coordination/family/init`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });

  if (!initResponse.ok) {
    const errorText = await initResponse.text().catch(() => "");
    throw new Error(errorText || "Falha ao inicializar equipe de coordenação.");
  }

  const initPayload = await initResponse.json().catch(() => null);
  const teamId = typeof initPayload?.team?.id === "string" ? initPayload.team.id : null;

  if (!teamId) {
    throw new Error("Equipe de coordenação indisponível.");
  }

  const membersResponse = await fetch(`${backendUrl}/coordination/family/members`);
  if (!membersResponse.ok) {
    const errorText = await membersResponse.text().catch(() => "");
    throw new Error(errorText || "Falha ao carregar membros da coordenação.");
  }

  const membersPayload = await membersResponse.json().catch(() => null);
  const members = Array.isArray(membersPayload?.members) ? membersPayload.members : [];

  return {
    teamId,
    members: members as CoordinationMember[],
  };
}

async function sendCoordinationMessage(params: {
  backendUrl: string;
  teamId: string;
  fromAgentId: string;
  toAgentId: string | null;
  messageType: string;
  content: string;
  metadata?: Record<string, unknown>;
}) {
  const response = await fetch(`${params.backendUrl}/coordination/team/${params.teamId}/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fromAgentId: params.fromAgentId,
      toAgentId: params.toAgentId,
      messageType: params.messageType,
      content: params.content,
      metadata: params.metadata || {},
    }),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(errorText || "Falha ao enviar mensagem para a coordenação.");
  }

  return response.json().catch(() => null);
}

function buildCoordinationAgentInstructions(member: CoordinationMember | null) {
  if (!member) return "";

  const roleLine = member.role ? `Cargo: ${member.role}.` : "";
  const personalityLine = member.personality ? `Personalidade: ${member.personality}.` : "";
  const expertiseLine = Array.isArray(member.expertise) && member.expertise.length > 0
    ? `Especialidades: ${member.expertise.join(", ")}.`
    : "";
  const name = member.name || member.id;

  return [
    `Agente selecionado: ${name}.`,
    roleLine,
    personalityLine,
    expertiseLine,
    "Responda como esse agente, mantendo a voz e o jeito descritos acima.",
  ]
    .filter(Boolean)
    .join("\n");
}

function normalizePrompt(prompt: string) {
  return prompt
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s?!.,]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function getPreviousAssistantText(messages: ChatMessage[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "agent" && typeof message?.content === "string" && message.content.trim()) {
      return message.content.trim();
    }
  }
  return "";
}

function isConfirmationReply(prompt: string, previousAssistantText: string) {
  const normalizedPrompt = normalizePrompt(prompt);
  if (!["sim", "nao", "ok", "pode", "confirmo"].includes(normalizedPrompt)) {
    return false;
  }

  const normalizedAssistant = normalizePrompt(previousAssistantText);
  if (!normalizedAssistant) {
    return false;
  }

  return (
    normalizedAssistant.includes("confirme") ||
    normalizedAssistant.includes("posso acessar") ||
    normalizedAssistant.includes("quer que eu") ||
    normalizedAssistant.includes("posso listar") ||
    normalizedAssistant.includes("deseja que eu")
  );
}

function mentionsDesktop(text: string) {
  const normalized = normalizePrompt(text);
  return (
    normalized.includes("area de trabalho") ||
    normalized.includes("desktop")
  );
}

function asksToListDesktop(text: string) {
  const normalized = normalizePrompt(text);
  if (!mentionsDesktop(normalized)) {
    return false;
  }

  return (
    normalized.includes("listar") ||
    normalized.includes("liste") ||
    normalized.includes("mostre") ||
    normalized.includes("o que tem") ||
    normalized.includes("quais arquivos") ||
    normalized.includes("quais pastas") ||
    normalized.includes("verifique")
  );
}

function isDesktopFollowUpConfirmation(prompt: string, previousAssistantText: string) {
  return isConfirmationReply(prompt, previousAssistantText) && mentionsDesktop(previousAssistantText);
}

function shouldHandleDesktopDirectly(prompt: string, previousAssistantText: string) {
  return asksToListDesktop(prompt) || isDesktopFollowUpConfirmation(prompt, previousAssistantText);
}

function asksForPdfExport(prompt: string) {
  const normalized = normalizePrompt(prompt);
  if (!normalized) return false;

  const triggers = [
    "pdf",
    "em pdf",
    "preciso em pdf",
    "gera pdf",
    "gera um pdf",
    "salva em pdf",
    "exporta em pdf",
    "transforma em pdf",
    "converte em pdf",
  ];

  return triggers.some((trigger) => normalized.includes(trigger));
}

async function getDirectPdfResult(
  user: NonNullable<ReturnType<typeof requireUser>>,
  chatId: string,
  prompt: string,
  previousAssistantText: string,
) {
  if (!asksForPdfExport(prompt)) {
    return null;
  }

  if (!previousAssistantText.trim()) {
    return {
      outputText: "Posso gerar um PDF, mas primeiro preciso de um conteudo ou resposta anterior para transformar.",
      trace: [] as Array<Record<string, unknown>>,
    };
  }

  const callId = `direct_pdf_${Date.now()}`;
  const token = createToken(user);

  try {
    const title = "Resposta do chat em PDF";
    const result = await runChatTool(user, chatId, "pdf_report", {
      path: `reports/chat-${chatId || Date.now()}.pdf`,
      title,
      content: previousAssistantText,
    });

    const pdfPath =
      result && typeof result === "object" && "path" in result && typeof result.path === "string"
        ? result.path
        : "";

    return {
      outputText: pdfPath
        ? `Pronto. O Tunico gerou o PDF da resposta anterior.\n\n[Baixar PDF](/api/files/download?path=${encodeURIComponent(pdfPath)}&token=${encodeURIComponent(token)})\n\nCaminho do arquivo:\n${pdfPath}`
        : "Pronto. Gerei o PDF da resposta anterior.",
      trace: [
        {
          type: "tool_call",
          label: "pdf_report",
          state: "complete",
          subtitle: "PDF gerado diretamente a partir da resposta anterior.",
          payload: {
            callId,
            output: result,
          },
        },
      ] as Array<Record<string, unknown>>,
    };
  } catch (error) {
    console.error("[PDF_EXPORT] primary export failed:", error);
    try {
      const fallbackResult = await runChatTool(user, chatId, "pdf_report", {
        path: path.join(".chocks-local", "exports", `chat-${chatId || Date.now()}-fallback.pdf`),
        title: "Resposta do chat em PDF",
        content: previousAssistantText,
      });

      const fallbackPath =
        fallbackResult && typeof fallbackResult === "object" && "path" in fallbackResult && typeof fallbackResult.path === "string"
          ? fallbackResult.path
          : "";

      return {
        outputText: fallbackPath
          ? `Pronto. O Tunico gerou o PDF da resposta anterior.\n\n[Baixar PDF](/api/files/download?path=${encodeURIComponent(fallbackPath)}&token=${encodeURIComponent(token)})\n\nCaminho do arquivo:\n${fallbackPath}`
          : "Pronto. O Tunico gerou o PDF da resposta anterior.",
        trace: [
          {
            type: "tool_call",
            label: "pdf_report",
            state: "complete",
            subtitle: "PDF gerado no fallback seguro dentro do workspace.",
            payload: {
              callId,
              output: fallbackResult,
            },
          },
        ] as Array<Record<string, unknown>>,
      };
    } catch (fallbackError) {
      console.error("[PDF_EXPORT] fallback export failed:", fallbackError);
    }

    return {
      outputText: normalizeUserFacingToolError(
        error instanceof Error ? error.message : String(error),
        "pdf_report",
      ),
      trace: [
        {
          type: "tool_call",
          label: "pdf_report",
          state: "error",
          subtitle: "Falha ao gerar PDF diretamente.",
          payload: {
            callId,
            output: {
              ok: false,
              error: normalizeUserFacingToolError(
                error instanceof Error ? error.message : String(error),
                "pdf_report",
              ),
            },
          },
        },
      ] as Array<Record<string, unknown>>,
    };
  }
}

async function resolveDesktopPath() {
  const candidates = [
    process.env.OneDrive ? path.join(process.env.OneDrive, "Desktop") : null,
    process.env.OneDrive ? path.join(process.env.OneDrive, "Area de Trabalho") : null,
    process.env.OneDrive ? path.join(process.env.OneDrive, "Área de Trabalho") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Desktop") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Area de Trabalho") : null,
    process.env.USERPROFILE ? path.join(process.env.USERPROFILE, "Área de Trabalho") : null,
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    try {
      const stat = await fs.stat(candidate);
      if (stat.isDirectory()) {
        return candidate;
      }
    } catch {
      continue;
    }
  }

  return null;
}

async function getDirectDesktopResult(prompt: string, previousAssistantText: string) {
  if (!shouldHandleDesktopDirectly(prompt, previousAssistantText)) {
    return null;
  }

  const settings = await readAppSettings();
  if (!settings.fullAccess) {
    return {
      outputText: 'Ative o cadeado de "acesso ao computador inteiro" para eu listar a sua Área de Trabalho do sistema.',
      trace: [] as Array<Record<string, unknown>>,
    };
  }

  const desktopPath = await resolveDesktopPath();
  if (!desktopPath) {
    return {
      outputText: "Nao encontrei a pasta da Área de Trabalho neste computador.",
      trace: [] as Array<Record<string, unknown>>,
    };
  }

  const result = await listFileEntries(desktopPath);
  const entries = Array.isArray(result.entries) ? [...result.entries] : [];
  entries.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name, "pt-BR"));

  const preview = entries.slice(0, 40);
  const lines = preview.map((entry) => `${entry.isDir ? "Pasta" : "Arquivo"}  ${entry.name}`);
  const summary = `${entries.length} ${entries.length === 1 ? "item encontrado" : "itens encontrados"}`;
  const suffix =
    entries.length > preview.length ? `\n\nMostrando ${preview.length} de ${entries.length} itens.` : "";
  const callId = `direct_desktop_${Date.now()}`;

  return {
    outputText: `Area de Trabalho\n${desktopPath}\n\n${summary}\n\n${lines.join("\n") || "Vazia."}${suffix}`,
    trace: [
      {
        type: "tool_call",
        label: "ls_safe",
        state: "complete",
        subtitle: "Listagem direta da Área de Trabalho.",
        payload: {
          callId,
          arguments: { path: desktopPath },
        },
      },
      {
        type: "tool_output",
        label: "ls_safe",
        state: "complete",
        subtitle: "Resultado da listagem da Área de Trabalho.",
        payload: {
          callId,
          output: result,
        },
      },
    ] as Array<Record<string, unknown>>,
  };
}

async function persistAssistantReply(
  user: NonNullable<ReturnType<typeof requireUser>>,
  chatId: string,
  prompt: string,
  messages: ChatMessage[],
  reply: string,
  selectedAgentId: string,
  selectedAgentName: string | null,
) {
  if (!chatId) return { userMessageId: null, assistantMessageId: null };

  const previousAgentId =
    [...messages].reverse().find((message) => message?.role === "agent")?.agentId || "chocks";
  const isFirstMessage = messages.length === 0;
  const showHandoff =
    selectedAgentId !== previousAgentId || (isFirstMessage && selectedAgentId !== "chocks");

  const resolvedAgentName = selectedAgentName || selectedAgentId;
  const handoffLabel = showHandoff ? `${resolvedAgentName} assumiu a conversa` : null;

  const title = prompt.slice(0, 30) || "Nova conversa";
  const { insertedMessageIds } = await appendConversationMessages(user, chatId, title, [
    {
      role: "user",
      content: prompt,
      streaming: false,
    },
    {
      role: "agent",
      content: reply,
      streaming: false,
      agentId: selectedAgentId,
      helperAgentId: null,
      handoffLabel,
      collaborationLabel: null,
    },
  ], selectedAgentId);

  const userMessageId = insertedMessageIds[0] ?? null;
  const assistantMessageId = insertedMessageIds[insertedMessageIds.length - 1] ?? null;
  return { userMessageId, assistantMessageId };
}

function toModelInput(messages: ChatMessage[]) {
  return messages
    .filter((message) => typeof message.content === "string" && message.content.trim())
    .map((message) => ({
      role: message.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: message.content,
    }));
}

function buildInstructions(
  fullAccess: boolean,
  permissionMode: string,
  memoryMode: string,
  memoryContext: ContextPack | null,
  workflow?: Awaited<ReturnType<typeof import('@/lib/server/store').getWorkflowState>>,
  psychProfile?: PsychologicalProfile | null,
  selectedAgent?: CoordinationMember | null,
) {
  let workflowSection = "";

  if (workflow) {
    const stepLines = workflow.steps
      .map((s, i) => `  ${i + 1}. [${s.status}] (id: ${s.id}) ${s.text}`)
      .join("\n");
    workflowSection = `

WORKFLOW ATIVO NESTA CONVERSA:
Objetivo: ${workflow.goal}${
      workflow.summary ? `\nContexto: ${workflow.summary}` : ""
    }
Etapas:
${stepLines}

Instruções sobre o workflow:
- Use workflow_update_step para marcar etapas como in_progress quando começar e completed quando terminar.
- Use o id exato da etapa (listado acima) ao chamar workflow_update_step.
- Ao iniciar uma etapa, mude seu status para in_progress ANTES de executá-la.
- Ao concluir, mude para completed IMEDIATAMENTE após.
- Não pergunte permissão para atualizar o workflow — faça automaticamente.
- Se o usuário pedir para criar ou alterar o plano, use workflow_replace.`;
  } else {
    workflowSection = `

Não há workflow ativo nesta conversa.
- Se o pedido for simples (1 ação), responda diretamente sem criar workflow.
- Se o pedido for complexo (3+ etapas, múltiplas tools, ou tarefa longa), aplique o padrão PLAN & EXECUTE: crie o workflow com workflow_replace antes de começar a executar.`;
  }

  let profileSection = "";
  if (psychProfile && psychProfile.totalFeedback > 0 && psychProfile.confidenceScore > 0.3) {
    profileSection = `

## PREFERÊNCIAS DO USUÁRIO (Análise Psicológica)
${generateProfilePrompt(psychProfile)}
Confiança desta análise: ${Math.round(psychProfile.confidenceScore * 100)}%
(Baseado em ${psychProfile.totalFeedback} respostas avaliadas: ${psychProfile.likeCount} positivas, ${psychProfile.dislikeCount} negativas)`;
  }

  let memorySection = "";
  if (memoryContext && shouldIncludeMemoryContext(memoryContext)) {
    memorySection = `

## MEMÓRIA DO USUÁRIO (Perfil consolidado + itens ativos)
- Antes de perguntar algo ao usuário, confira esta seção e use os fatos aqui quando aplicável.
- Se houver conflito/ambiguidade, peça confirmação.
- Não mencione "memória", "orchestrator" ou camadas internas ao usuário; use a informação naturalmente.

${formatMemoryContextForPrompt(memoryContext)}`;
  }

  const agentSection = buildCoordinationAgentInstructions(selectedAgent ?? null);

  return `${BASE_INSTRUCTIONS}

Filesystem mode: ${fullAccess ? "full computer access enabled by the user" : "restricted to current workspace"}.
Permission mode: ${permissionMode}.
Memory mode: ${memoryMode}.
Obsidian vault path: obsidian-vault/ inside the current workspace.${memorySection}${profileSection}${workflowSection}${
    agentSection ? `\n\n${agentSection}` : ""
  }`;
}

function shouldIncludeMemoryContext(memoryContext: ContextPack) {
  return Boolean(
    (memoryContext.summaryShort || "").trim() ||
      (memoryContext.summaryLong || "").trim() ||
      (Array.isArray(memoryContext.keyFacts) && memoryContext.keyFacts.length) ||
      (Array.isArray(memoryContext.activeGoals) && memoryContext.activeGoals.length) ||
      (Array.isArray(memoryContext.knownConstraints) && memoryContext.knownConstraints.length) ||
      (memoryContext.interactionPreferences && Object.keys(memoryContext.interactionPreferences).length) ||
      (Array.isArray(memoryContext.memoryItems) && memoryContext.memoryItems.length),
  );
}

function safeJson(value: unknown) {
  try {
    return JSON.stringify(value);
  } catch {
    return "";
  }
}

function clampText(text: string, maxLen: number) {
  const normalized = String(text || "").trim().replace(/\s+/g, " ");
  if (!normalized) return "";
  return normalized.length > maxLen ? `${normalized.slice(0, maxLen - 1)}…` : normalized;
}

function formatMemoryContextForPrompt(memoryContext: ContextPack) {
  const lines: string[] = [];

  const summaryShort = clampText(memoryContext.summaryShort, 500);
  const summaryLong = clampText(memoryContext.summaryLong, 900);

  if (summaryShort) lines.push(`summaryShort: ${summaryShort}`);
  if (summaryLong) lines.push(`summaryLong: ${summaryLong}`);

  if (Array.isArray(memoryContext.keyFacts) && memoryContext.keyFacts.length) {
    lines.push(`keyFacts: ${clampText(safeJson(memoryContext.keyFacts), 700)}`);
  }
  if (Array.isArray(memoryContext.activeGoals) && memoryContext.activeGoals.length) {
    lines.push(`activeGoals: ${clampText(safeJson(memoryContext.activeGoals), 700)}`);
  }
  if (memoryContext.interactionPreferences && Object.keys(memoryContext.interactionPreferences).length) {
    lines.push(`interactionPreferences: ${clampText(safeJson(memoryContext.interactionPreferences), 700)}`);
  }
  if (Array.isArray(memoryContext.knownConstraints) && memoryContext.knownConstraints.length) {
    lines.push(`knownConstraints: ${clampText(safeJson(memoryContext.knownConstraints), 700)}`);
  }

  if (Array.isArray(memoryContext.memoryItems) && memoryContext.memoryItems.length) {
    lines.push("memoryItems:");
    for (const item of memoryContext.memoryItems.slice(0, 12)) {
      const label = [item.type, item.category].filter(Boolean).join("/");
      const content = clampText(item.content, 220);
      lines.push(`- ${label}: ${content}`);
    }
  }

  return lines.join("\n");
}

function workflowHasOpenSteps(
  workflow?: Awaited<ReturnType<typeof import('@/lib/server/store').getWorkflowState>>,
) {
  if (!workflow || !Array.isArray(workflow.steps) || workflow.steps.length === 0) {
    return false;
  }
  return workflow.steps.some((step) => step.status !== "completed");
}


function promptExplicitlyRequestsMemory(prompt: string) {
  const normalized = normalizePrompt(prompt);
  const explicitTriggers = [
    "memorize isso",
    "memoriza isso",
    "guarde isso",
    "guarda isso",
    "lembre disso",
    "salva isso na memoria",
    "salve isso na memoria",
    "registre isso",
    "anote isso",
  ];
  return explicitTriggers.some((trigger) => normalized.includes(trigger));
}

function promptLooksDurablyImportant(prompt: string) {
  const normalized = normalizePrompt(prompt);
  const durableSignals = [
    "meu nome e",
    "me chamo",
    "eu prefiro",
    "sempre",
    "nunca",
    "decidimos",
    "decisao",
    "projeto",
    "stack",
    "objetivo",
    "pra lembrar depois",
    "para lembrar depois",
  ];
  return durableSignals.some((signal) => normalized.includes(signal));
}

function inferMemoryType(prompt: string, finalText: string) {
  const source = `${normalizePrompt(prompt)} ${normalizePrompt(finalText)}`;
  if (/(meu nome e|me chamo|sou o|prefiro|usuario)/.test(source)) return "person";
  if (/(decidimos|decisao|ficou definido|vamos usar)/.test(source)) return "decision";
  if (/(projeto|roadmap|entrega|feature|repositorio|vault)/.test(source)) return "project";
  if (/(resumo|log|andamento|progresso)/.test(source)) return "summary";
  return "memory";
}

function inferMemoryTitle(memoryType: string, prompt: string) {
  const normalized = normalizePrompt(prompt);
  if (memoryType === "person") return "Preferencias do usuario";
  if (memoryType === "decision") return "Decisao importante";
  if (memoryType === "project") {
    if (normalized.includes("obsidian")) return "Contexto do vault Obsidian";
    if (normalized.includes("projeto")) return "Contexto de projeto";
    return "Projeto ativo";
  }
  if (memoryType === "summary") return "Resumo salvo";
  return "Memoria importante";
}

function buildMemorySummary(prompt: string, finalText: string) {
  const promptLine = prompt.trim().replace(/\s+/g, " ");
  const replyLine = finalText.trim().replace(/\s+/g, " ");
  const parts = [];
  if (promptLine) parts.push(`Pedido do usuario: ${promptLine}`);
  if (replyLine) parts.push(`Resposta final: ${replyLine}`);
  return parts.join(" ");
}

function buildMemoryDetails(prompt: string, finalText: string) {
  return [
    "## Origem",
    "",
    `Usuario: ${prompt.trim() || "n/a"}`,
    "",
    "## Resultado",
    "",
    finalText.trim() || "n/a",
  ].join("\n");
}

function normalizeUserFacingToolError(rawMessage: string, toolName?: string) {
  const normalized = rawMessage.trim();

  if (!normalized) {
    return "Nao foi possivel concluir essa etapa.";
  }

  if (normalized.includes("Path outside project")) {
    return "O caminho solicitado esta fora do projeto atual.";
  }

  if (normalized.includes("content required")) {
    return "Faltou o conteudo necessario para gerar o relatorio.";
  }

  if (normalized.includes("goal required") || normalized.includes("steps required")) {
    return "O plano recebido estava incompleto.";
  }

  if (normalized.includes("no active workflow")) {
    return "Nao havia um workflow ativo para atualizar.";
  }

  if (normalized.includes("id required")) {
    return "A etapa do workflow nao informou um identificador valido.";
  }

  if (normalized.includes("ENOENT") || normalized.includes("no such file or directory")) {
    if (toolName === "ls_safe") {
      return "A pasta solicitada nao foi encontrada no projeto.";
    }
    if (toolName === "file_read") {
      return "O arquivo solicitado nao foi encontrado no projeto.";
    }
    if (toolName === "pdf_report") {
      return "Nao foi possivel salvar o PDF no caminho solicitado.";
    }
    return "O caminho solicitado nao foi encontrado no projeto.";
  }

  if (normalized.includes("EACCES") || normalized.includes("EPERM")) {
    return "Acesso negado ao caminho solicitado.";
  }

  if (normalized.includes("read_only") || normalized.includes("Modo somente leitura ativo")) {
    return "O projeto esta em modo somente leitura para essa operacao.";
  }

  return normalized
    .replace(/[A-Za-z]:\\[^\s'\"]+/g, "[caminho oculto]")
    .replace(/\s+/g, " ")
    .trim();
}

async function maybeAutoCaptureMemory(params: {
  user: SessionUser;
  chatId: string;
  prompt: string;
  finalText: string;
  traceEntries: unknown[];
  memoryMode: string;
}) {
  const { user, chatId, prompt, finalText, traceEntries, memoryMode } = params;
  const explicit = promptExplicitlyRequestsMemory(prompt);
  const important = promptLooksDurablyImportant(prompt);
  const alreadyCaptured = traceEntries.some(
    (entry) =>
      entry &&
      typeof entry === "object" &&
      "type" in entry &&
      "label" in entry &&
      "state" in entry &&
      entry.type === "tool_call" &&
      entry.label === "memory_capture" &&
      entry.state === "complete",
  );

  if (memoryMode === "off") {
    return null;
  }

  if (memoryMode === "explicit" && !explicit) {
    return null;
  }

  if ((!explicit && !important) || alreadyCaptured) {
    return null;
  }

  const memoryType = inferMemoryType(prompt, finalText);
  const result = await runChatTool(user, chatId, "memory_capture", {
    memory_type: memoryType,
    title: inferMemoryTitle(memoryType, prompt),
    summary: buildMemorySummary(prompt, finalText),
    details: buildMemoryDetails(prompt, finalText),
    related_notes: [
      "Home",
      "Indice",
      "Memoria/hub-memoria",
      "Projetos/projeto-chocks",
      "Pessoas/bruno-silva",
    ],
    next_actions: explicit ? ["Reutilizar esta memoria quando o tema voltar."] : [],
    tags: explicit ? ["solicitado-pelo-usuario", "memoria-automatica"] : ["memoria-automatica"],
  });

  return {
    type: "tool_call",
    label: "memory_capture",
    state: "complete",
    subtitle: explicit
      ? "Memoria salva por solicitacao explicita do usuario."
      : "Memoria salva automaticamente por relevancia duradoura.",
    payload: { output: result },
  } as const;
}

async function maybeAutoCaptureMemoryOrchestrator(params: {
  user: SessionUser;
  chatId: string;
  prompt: string;
  recentUserTexts: string[];
  sourceMessageId: number | null;
  apiKey: string;
  model: string;
  actor: string;
}) {
  if (!isMemoryOrchestratorEnabled()) {
    return;
  }
  if (!hasDatabase()) {
    return;
  }

  const { candidates, stats } = await extractMemoryCandidates({
    input: {
      sourceConversationId: params.chatId,
      sourceMessageId: params.sourceMessageId,
      userPrompt: params.prompt,
      recentUserTexts: params.recentUserTexts,
      createdBy: "chat_stream_deterministic_v1",
    },
    apiKey: params.apiKey,
    llmModel: process.env.OPENAI_MEMORY_EXTRACTION_MODEL?.trim() || params.model,
    maxTotalCandidates: 5,
    maxLlmAccepted: 3,
  });

  console.info(`[MemoryOrchestrator] heuristic extractor ran; generated=${stats.heuristicGenerated}`);
  if (stats.llmAttempted) {
    console.info(
      `[MemoryOrchestrator] LLM extractor ran; accepted=${stats.llmAccepted} discarded=${stats.llmDiscarded}`,
    );
  }
  if (stats.llmAttempted && stats.llmFailed) {
    console.warn("[MemoryOrchestrator] LLM extractor failed; falling back to heuristic-only candidates.");
  }
  console.info(`[MemoryOrchestrator] combined candidates ready; total=${stats.combinedTotal}`);

  if (candidates.length === 0) {
    return;
  }

  try {
    await orchestrateMemoryCandidates({
      userId: params.user.id,
      candidates: candidates.map((candidate) => ({ id: crypto.randomUUID(), ...candidate })),
      actor: params.actor,
      reason: "chat_stream_auto",
      compileProfile: true,
    });
  } catch (error) {
    // Nunca quebrar o chat por falha de memória.
    const message = error instanceof Error ? error.message : String(error);
    console.warn("[MemoryOrchestrator] orchestration failed; falling back to chat only:", message);
  }
}

function buildFallbackFinalTextFromTrace(traceEntries: unknown[]) {
  let completedTools = 0;
  const errorMessages: string[] = [];
  let pdfPath = "";

  for (const entry of traceEntries) {
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    const type = typeof item.type === "string" ? item.type : "";
    const label = typeof item.label === "string" ? item.label : "";
    const state = typeof item.state === "string" ? item.state : "";
    const payload = item.payload && typeof item.payload === "object"
      ? (item.payload as Record<string, unknown>)
      : null;

    if (type === "tool_call" && state === "complete") {
      completedTools += 1;
    }

    if (type === "tool_call" && state === "error") {
      const output = payload?.output && typeof payload.output === "object"
        ? (payload.output as Record<string, unknown>)
        : null;
      const error = typeof output?.error === "string" ? output.error.trim() : "";
      if (error) errorMessages.push(normalizeUserFacingToolError(error, label));
    }

    if (type === "tool_call" && label === "pdf_report" && state === "complete") {
      const output = payload?.output && typeof payload.output === "object"
        ? (payload.output as Record<string, unknown>)
        : null;
      const pathValue = typeof output?.path === "string" ? output.path.trim() : "";
      if (pathValue) {
        pdfPath = pathValue;
      }
    }
  }

  if (pdfPath) {
    return `Conclui a execucao e gerei o relatorio PDF em: ${pdfPath}`;
  }

  if (errorMessages.length > 0) {
    return `Execucao concluida com pendencias: ${errorMessages[0]}`;
  }

  if (completedTools > 0) {
    return "Execucao concluida. Etapas processadas com sucesso.";
  }

  return "Processamento finalizado.";
}

function getNextOpenWorkflowStep(
  workflow?: Awaited<ReturnType<typeof import('@/lib/server/store').getWorkflowState>>,
) {
  return workflow?.steps.find((step) => step.status !== "completed") ?? null;
}

function getLastSuccessfulToolLabel(traceEntries: unknown[]) {
  for (let index = traceEntries.length - 1; index >= 0; index -= 1) {
    const entry = traceEntries[index];
    if (!entry || typeof entry !== "object") continue;
    const item = entry as Record<string, unknown>;
    if (item.type === "tool_call" && item.state === "complete" && typeof item.label === "string") {
      return item.label;
    }
  }
  return "";
}

function buildTargetedWorkflowNudge(
  workflow: Awaited<ReturnType<typeof import('@/lib/server/store').getWorkflowState>> | null | undefined,
  traceEntries: unknown[],
) {
  const nextStep = getNextOpenWorkflowStep(workflow ?? undefined);
  const lastTool = getLastSuccessfulToolLabel(traceEntries);
  const stepText = nextStep?.text || "Continue a proxima etapa pendente do workflow";
  const normalizedStep = normalizePrompt(stepText);

  let action = "Execute agora a proxima etapa com a tool adequada.";

  if (normalizedStep.includes("listar") || normalizedStep.includes("pasta")) {
    action = "Use ls_safe agora para listar a pasta necessaria e continuar o workflow.";
  } else if (normalizedStep.includes("ler") || normalizedStep.includes("conteudo") || normalizedStep.includes("arquivo")) {
    action = "Use file_read agora em um dos arquivos identificados para avancar essa etapa.";
  } else if (normalizedStep.includes("analisa") || normalizedStep.includes("problema") || normalizedStep.includes("recomend")) {
    action =
      lastTool === "file_read"
        ? "Continue a analise usando o conteudo ja lido e atualize o workflow. Se faltar contexto, leia outro arquivo com file_read."
        : "Leia os arquivos necessarios com file_read e depois continue a analise desta etapa.";
  } else if (normalizedStep.includes("pdf") || normalizedStep.includes("relatorio")) {
    action = "Use pdf_report agora para gerar o relatorio final e concluir a etapa.";
  }

  const stepHint = nextStep ? ` Etapa atual: ${nextStep.text}.` : "";
  const lastToolHint = lastTool ? ` Ultima tool concluida: ${lastTool}.` : "";
  return `Nao finalize com texto agora.${stepHint} ${action}${lastToolHint} So responda ao usuario depois de executar a proxima tool.`.trim();
}

function buildIncompleteWorkflowMessage(
  workflow?: Awaited<ReturnType<typeof import('@/lib/server/store').getWorkflowState>>,
) {
  const pendingSteps = Array.isArray(workflow?.steps)
    ? workflow.steps.filter((step) => step.status !== "completed")
    : [];

  if (pendingSteps.length === 0) {
    return "Execucao incompleta. Ainda ha etapas pendentes.";
  }

  const preview = pendingSteps
    .slice(0, 2)
    .map((step) => step.text)
    .join("; ");

  return preview
    ? `Execucao incompleta. Ainda faltam ${pendingSteps.length} etapa(s): ${preview}`
    : `Execucao incompleta. Ainda faltam ${pendingSteps.length} etapa(s).`;
}

async function createResponseStream(
  apiKey: string,
  body: Record<string, unknown>,
  onTextDelta: (delta: string) => void,
) {
  const client = new OpenAI({ apiKey });
  
  const tools = Array.isArray(body.tools) ? (body.tools as ChatCompletionTool[]) : undefined;

  const stream = await client.chat.completions.create({
    model: String(body.model),
    messages: body.input as ChatCompletionMessageParam[],
    ...(tools
      ? {
          tools: tools.map((tool) => {
            if (tool.type === "function" && !("function" in tool)) {
              return tool as ChatCompletionTool;
            }
            return tool;
          }),
        }
      : {}),
    ...(body.tool_choice ? { tool_choice: body.tool_choice as "auto" | "required" } : {}),
    stream: true,
    max_tokens: Number(body.max_output_tokens),
  });

  let fullContent = "";
  const toolCalls: Array<{ id: string; function: { name: string; arguments: string } }> = [];
  let lastChunk: OpenAI.Chat.Completions.ChatCompletionChunk | null = null;

  for await (const chunk of stream) {
    lastChunk = chunk;
    const delta = chunk.choices[0]?.delta;
    
    if (delta?.content) {
      fullContent += delta.content;
      onTextDelta(delta.content);
    }

    if (delta?.tool_calls) {
      for (const tcDelta of delta.tool_calls) {
        if (tcDelta.index !== undefined) {
          if (!toolCalls[tcDelta.index]) {
            toolCalls[tcDelta.index] = { id: "", function: { name: "", arguments: "" } };
          }
          const tc = toolCalls[tcDelta.index];
          if (tcDelta.id) tc.id = tcDelta.id;
          if (tcDelta.function?.name) tc.function.name = tcDelta.function.name;
          if (tcDelta.function?.arguments) tc.function.arguments += tcDelta.function.arguments;
        }
      }
    }
  }

  const response = {
    id: lastChunk?.id || `res_${Date.now()}`,
    output_text: fullContent,
    output: toolCalls
      .filter(tc => tc.id)
      .map(tc => ({
        type: "function_call",
        name: tc.function.name,
        call_id: tc.id,
        arguments: tc.function.arguments,
      })),
    status: lastChunk?.choices[0]?.finish_reason === "length" ? "incomplete" : "completed"
  };

  if (response.status === "incomplete") {
    onTextDelta("\n\n_(resposta truncada por limite de tokens — tente novamente ou simplifique o pedido)_");
  }

  return response;
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return new Response("OPENAI_API_KEY is not configured.", { status: 500 });
  }

  const settings = await readAppSettings();
  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const reasoningEffort =
    process.env.OPENAI_REASONING_EFFORT?.trim() || DEFAULT_REASONING_EFFORT;
  const textVerbosity =
    process.env.OPENAI_TEXT_VERBOSITY?.trim() || DEFAULT_TEXT_VERBOSITY;
  const maxOutputTokens =
    parsePositiveInt(process.env.OPENAI_MAX_OUTPUT_TOKENS) ?? DEFAULT_MAX_OUTPUT_TOKENS;

  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  const backendUrl = getBackendUrl();
  const coordinationData = await fetchCoordinationData(backendUrl);
  const requestedAgentId = typeof body?.selectedAgentId === "string" ? body.selectedAgentId.trim() : null;
  const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : [];
  
  const chat = chatId ? await getConversationById(user, chatId).catch(() => null) : null;
  const lastAgentId =
    [...messages]
      .reverse()
      .find(
        (m) =>
          (m?.role === "agent" || m?.role === "assistant") &&
          typeof (m as ChatMessage).agentId === "string" &&
          (m as ChatMessage).agentId,
      )?.agentId ?? null;

  const selectedAgentId = pickCoordinationAgentId(
    coordinationData.members, 
    requestedAgentId, 
    chat?.activeAgent, 
    lastAgentId
  );
  const selectedAgent = getCoordinationMember(coordinationData.members, selectedAgentId);
  const selectedAgentName = selectedAgent?.name || selectedAgentId;
  const coordinationTeamId =
    typeof body?.coordinationTeamId === "string" && body.coordinationTeamId.trim()
      ? body.coordinationTeamId.trim()
      : coordinationData.teamId;
  const previousAssistantText = getPreviousAssistantText(messages);
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && typeof message?.content === "string");
  const prompt = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";

  if (!prompt) {
    return new Response("A user message is required.", { status: 400 });
  }

  if (!coordinationTeamId) {
    return new Response("Coordination team not available.", { status: 503 });
  }

  await sendCoordinationMessage({
    backendUrl,
    teamId: coordinationTeamId,
    fromAgentId: user.id,
    toAgentId: selectedAgentId,
    messageType: "direct_message",
    content: prompt,
    metadata: {
      chatId,
      direction: "user_to_agent",
    },
  });

  const startedAt = Date.now();
  const directDesktopResult = await getDirectDesktopResult(prompt, previousAssistantText);
  const directPdfResult = await getDirectPdfResult(user, chatId, prompt, previousAssistantText);

  if (directDesktopResult) {
    const persisted = await persistAssistantReply(
      user,
      chatId,
      prompt,
      messages,
      directDesktopResult.outputText,
      selectedAgentId,
      selectedAgentName,
    );
    const assistantMessageId = persisted.assistantMessageId;
    const sourceMessageId = (() => {
      const parsed = Number(persisted.userMessageId);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })();
    const recentUserTexts = messages
      .filter((message) => message?.role === "user" && typeof message?.content === "string")
      .map((message) => message.content)
      .slice(0, -1);

    setTimeout(() => {
      void maybeAutoCaptureMemoryOrchestrator({
        user,
        chatId,
        prompt,
        recentUserTexts,
        sourceMessageId,
        apiKey,
        model,
        actor: selectedAgentName || selectedAgentId,
      }).catch(() => null);
    }, 0);
    await sendCoordinationMessage({
      backendUrl,
      teamId: coordinationTeamId,
      fromAgentId: selectedAgentId,
      toAgentId: user.id,
      messageType: "direct_message",
      content: directDesktopResult.outputText,
      metadata: {
        chatId,
        direction: "agent_to_user",
      },
    });
    await appendLog(user, "info", "Listagem direta da Área de Trabalho", {
      chatId,
      fullAccess: settings.fullAccess,
      totalMs: Date.now() - startedAt,
    }).catch(() => null);

    const desktopReadable = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const traceEntry of directDesktopResult.trace) {
          controller.enqueue(encodeEvent("trace", traceEntry));
        }
        controller.enqueue(encodeEvent("text-delta", { delta: directDesktopResult.outputText }));
        controller.enqueue(
          encodeEvent("done", {
            output_text: directDesktopResult.outputText,
            trace: directDesktopResult.trace,
            messageId: assistantMessageId,
            model: "direct-desktop-list",
          }),
        );
        controller.close();
      },
    });

    return new Response(desktopReadable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }

  if (directPdfResult) {
    const persisted = await persistAssistantReply(
      user,
      chatId,
      prompt,
      messages,
      directPdfResult.outputText,
      selectedAgentId,
      selectedAgentName,
    );
    const assistantMessageId = persisted.assistantMessageId;
    const sourceMessageId = (() => {
      const parsed = Number(persisted.userMessageId);
      return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
    })();
    const recentUserTexts = messages
      .filter((message) => message?.role === "user" && typeof message?.content === "string")
      .map((message) => message.content)
      .slice(0, -1);

    setTimeout(() => {
      void maybeAutoCaptureMemoryOrchestrator({
        user,
        chatId,
        prompt,
        recentUserTexts,
        sourceMessageId,
        apiKey,
        model,
        actor: selectedAgentName || selectedAgentId,
      }).catch(() => null);
    }, 0);
    await sendCoordinationMessage({
      backendUrl,
      teamId: coordinationTeamId,
      fromAgentId: selectedAgentId,
      toAgentId: user.id,
      messageType: "direct_message",
      content: directPdfResult.outputText,
      metadata: {
        chatId,
        direction: "agent_to_user",
      },
    });
    await appendLog(user, "info", "Geracao direta de PDF", {
      chatId,
      totalMs: Date.now() - startedAt,
    }).catch(() => null);

    const pdfReadable = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const traceEntry of directPdfResult.trace) {
          controller.enqueue(encodeEvent("trace", traceEntry));
        }
        controller.enqueue(encodeEvent("text-delta", { delta: directPdfResult.outputText }));
        controller.enqueue(
          encodeEvent("done", {
            output_text: directPdfResult.outputText,
            trace: directPdfResult.trace,
            messageId: assistantMessageId,
            model: "direct-pdf-export",
          }),
        );
        controller.close();
      },
    });

    return new Response(pdfReadable, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  }



  const modelInput = toModelInput(messages);

  // Load workflow so the agent knows the plan and can update steps autonomously
  const activeWorkflow = chatId ? await getWorkflowState(user, chatId).catch(() => null) : null;

  const readable = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      let finalText = "";
      let firstTokenAt: number | null = null;
      const traceEntries: unknown[] = [];
      const toolOutputCache = new Map<string, string>();

      try {
        const [psychProfile, memoryContext] = await Promise.all([
          getPsychologicalProfile(user.id).catch(() => null),
          isMemoryOrchestratorEnabled() && settings.memoryMode !== "off"
            ? buildContextPack({
                userId: user.id,
                agentType: selectedAgentId ?? undefined,
                taskType: "chat",
                limitItems: 12,
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        const currentMessages: Array<{ role: string; content: string }> = [
          {
            role: "system",
            content: buildInstructions(
              settings.fullAccess,
              settings.permissionMode,
              settings.memoryMode,
              memoryContext,
              activeWorkflow ?? undefined,
              psychProfile,
              selectedAgent,
            ),
          },
          ...modelInput,
        ];

        const workflowRequiresTools = workflowHasOpenSteps(activeWorkflow ?? undefined);
        const strictToolRequirement = workflowRequiresTools;

        controller.enqueue(
          encodeEvent("trace", {
            type: "model",
            label: "OpenAI Chat",
            state: "pending",
            subtitle: "Preparando resposta com tool calls.",
            payload: {
              model,
              reasoningEffort,
              textVerbosity,
              maxOutputTokens,
              fullAccess: settings.fullAccess,
              permissionMode: settings.permissionMode,
              selectedAgentId,
            },
          }),
        );

        let response = await createResponseStream(
          apiKey,
          {
            model,
            input: currentMessages,
            tools: chatToolDefinitions,
            tool_choice: strictToolRequirement ? "required" : "auto",
            max_output_tokens: maxOutputTokens,
          },
          (delta) => {
            if (!firstTokenAt) {
              firstTokenAt = Date.now();
            }
            finalText += delta;
          },
        );

        if (strictToolRequirement && (!response.output || response.output.length === 0)) {
          const latestWorkflowForRetry = chatId ? await getWorkflowState(user, chatId).catch(() => null) : null;
          const enforceTrace = {
            type: "model",
            label: "Tool enforcement",
            state: "pending",
            subtitle: "Resposta sem tool call. Forcando execucao de ferramenta.",
          };
          traceEntries.push(enforceTrace);
          controller.enqueue(encodeEvent("trace", enforceTrace));

          const nudgeText = buildTargetedWorkflowNudge(latestWorkflowForRetry, traceEntries);
          currentMessages.push({ role: "assistant", content: response.output_text || null });
          currentMessages.push({ role: "user", content: nudgeText });

          response = await createResponseStream(
            apiKey,
            {
              model,
              input: currentMessages,
              tools: chatToolDefinitions,
              tool_choice: "required",
            },
            (delta) => {
              if (!firstTokenAt) {
                firstTokenAt = Date.now();
              }
              finalText += delta;
            },
          );
        }

        for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
          const toolCalls = Array.isArray(response.output)
            ? response.output.filter((item) => item.type === "function_call")
            : [];

          if (toolCalls.length === 0) {
            if (strictToolRequirement) {
              const latestWorkflowForLoop = chatId ? await getWorkflowState(user, chatId).catch(() => null) : null;
              const nudgeTrace = {
                type: "model",
                label: "Tool enforcement",
                state: "pending",
                subtitle: "Sem tool call no loop; solicitando execucao da proxima etapa.",
              };
              traceEntries.push(nudgeTrace);
              controller.enqueue(encodeEvent("trace", nudgeTrace));

              const nudgeText = buildTargetedWorkflowNudge(latestWorkflowForLoop, traceEntries);
              currentMessages.push({ role: "assistant", content: response.output_text || null });
              currentMessages.push({ role: "user", content: nudgeText });

              response = await createResponseStream(
                apiKey,
                {
                  model,
                  input: currentMessages,
                  tools: chatToolDefinitions,
                  tool_choice: "required",
                },
                (delta) => {
                  if (!firstTokenAt) {
                    firstTokenAt = Date.now();
                  }
                  finalText += delta;
                },
              );
              continue;
            }
            break;
          }

          // Add assistant's tool calls to messages
          currentMessages.push({
            role: "assistant",
            content: response.output_text || null,
            tool_calls: toolCalls.map((tc) => ({
              id: tc.call_id,
              type: "function",
              function: { name: tc.name, arguments: tc.arguments },
            })),
          });

          for (const call of toolCalls) {
            const callId = typeof call.call_id === "string" ? call.call_id : crypto.randomUUID();
            const toolName = typeof call.name === "string" ? call.name : "unknown_tool";
            const rawArguments = typeof call.arguments === "string" ? call.arguments : "{}";
            const toolSignature = `${toolName}:${rawArguments}`;

            if (toolOutputCache.has(toolSignature)) {
              const cachedOutput = toolOutputCache.get(toolSignature) || JSON.stringify({ ok: true, output: null });
              const cacheTrace = {
                type: "tool_call",
                label: toolName,
                state: "complete",
                subtitle: "Chamada repetida detectada; reutilizando resultado anterior.",
                payload: {
                  callId,
                  cached: true,
                },
              };
              traceEntries.push(cacheTrace);
              controller.enqueue(encodeEvent("trace", cacheTrace));
              currentMessages.push({ role: "tool", tool_call_id: callId, content: cachedOutput });
              continue;
            }

            const callTrace = {
              type: "tool_call",
              label: toolName,
              state: "pending",
              subtitle: "Executando tool no servidor.",
              payload: {
                callId,
                arguments: rawArguments,
              },
            };
            traceEntries.push(callTrace);
            controller.enqueue(encodeEvent("trace", callTrace));

            let parsedArgs: Record<string, unknown> = {};
            try {
              parsedArgs = JSON.parse(rawArguments);
            } catch (error) {
              const output = JSON.stringify({
                ok: false,
                error: `invalid JSON arguments: ${error instanceof Error ? error.message : String(error)}`,
              });
              const outputTrace = {
                type: "tool_call",
                label: toolName,
                state: "error",
                subtitle: "Falha ao interpretar os argumentos da tool.",
                payload: { callId, output: JSON.parse(output) },
              };
              traceEntries.push(outputTrace);
              controller.enqueue(encodeEvent("trace", outputTrace));
              currentMessages.push({ role: "tool", tool_call_id: callId, content: output });
              continue;
            }

            try {
              const result = await runChatTool(user, chatId, toolName, parsedArgs);
              const output = JSON.stringify({ ok: true, output: result });
              toolOutputCache.set(toolSignature, output);
              const outputTrace = {
                type: "tool_call",
                label: toolName,
                state: "complete",
                subtitle: "Tool executada com sucesso.",
                payload: { callId, output: result },
              };
              traceEntries.push(outputTrace);
              controller.enqueue(encodeEvent("trace", outputTrace));
              currentMessages.push({ role: "tool", tool_call_id: callId, content: output });
            } catch (error) {
              const normalizedError = normalizeUserFacingToolError(
                error instanceof Error ? error.message : String(error),
                toolName,
              );
              const output = JSON.stringify({
                ok: false,
                error: normalizedError,
              });
              toolOutputCache.set(toolSignature, output);
              const outputTrace = {
                type: "tool_call",
                label: toolName,
                state: "error",
                subtitle: "Tool retornou erro.",
                payload: { callId, output: JSON.parse(output) },
              };
              traceEntries.push(outputTrace);
              controller.enqueue(encodeEvent("trace", outputTrace));
              currentMessages.push({ role: "tool", tool_call_id: callId, content: output });
            }
          }

          response = await createResponseStream(
            apiKey,
            {
              model,
              input: currentMessages,
              tools: chatToolDefinitions,
              tool_choice: strictToolRequirement ? "required" : "auto",
            },
            (delta) => {
              if (!firstTokenAt) {
                firstTokenAt = Date.now();
              }
              finalText += delta;
            },
          );
        }

        if (!finalText && typeof response.output_text === "string") {
          finalText = response.output_text;
        }

        finalText = cleanText(finalText);

        const latestWorkflow = chatId ? await getWorkflowState(user, chatId).catch(() => null) : null;
        const hasOpenWorkflowSteps = workflowHasOpenSteps(latestWorkflow ?? undefined);

        if (!finalText.trim()) {
          finalText = hasOpenWorkflowSteps
            ? buildIncompleteWorkflowMessage(latestWorkflow ?? undefined)
            : buildFallbackFinalTextFromTrace(traceEntries);
        }

        if (
          hasOpenWorkflowSteps &&
          /(execucao concluida|etapas processadas com sucesso|conclui a execucao|processamento finalizado)/i.test(finalText)
        ) {
          finalText = buildIncompleteWorkflowMessage(latestWorkflow ?? undefined);
        }

        const memoryTrace = await maybeAutoCaptureMemory({
          user,
          chatId,
          prompt,
          finalText,
          traceEntries,
          memoryMode: settings.memoryMode,
        }).catch(() => null);
        if (memoryTrace) {
          traceEntries.push(memoryTrace);
          controller.enqueue(encodeEvent("trace", memoryTrace));
        }

        const persisted = await persistAssistantReply(
          user,
          chatId,
          prompt,
          messages,
          finalText,
          selectedAgentId,
          selectedAgentName,
        );
        const assistantMessageId = persisted.assistantMessageId;
        const sourceMessageId = (() => {
          const parsed = Number(persisted.userMessageId);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })();
        const recentUserTexts = messages
          .filter((message) => message?.role === "user" && typeof message?.content === "string")
          .map((message) => message.content)
          .slice(0, -1);

        setTimeout(() => {
          void maybeAutoCaptureMemoryOrchestrator({
            user,
            chatId,
            prompt,
            recentUserTexts,
            sourceMessageId,
            apiKey,
            model,
            actor: selectedAgentName || selectedAgentId,
          }).catch(() => null);
        }, 0);

        await sendCoordinationMessage({
          backendUrl,
          teamId: coordinationTeamId,
          fromAgentId: selectedAgentId,
          toAgentId: user.id,
          messageType: "direct_message",
          content: finalText,
          metadata: {
            chatId,
            direction: "agent_to_user",
          },
        });

        await appendLog(user, "info", "Resposta enviada", {
          chatId,
          model,
          maxOutputTokens,
          reasoningEffort,
          textVerbosity,
          firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
          totalMs: Date.now() - startedAt,
        });

        controller.enqueue(
          encodeEvent("done", {
            output_text: finalText,
            trace: [
              ...traceEntries,
              {
                type: "model",
                label: "OpenAI Responses",
                state: "complete",
                subtitle: "Resposta final consolidada.",
                payload: {
                  model,
                  firstTokenMs: firstTokenAt ? firstTokenAt - startedAt : null,
                  totalMs: Date.now() - startedAt,
                },
              },
            ],
            messageId: assistantMessageId,
            model,
          }),
        );
        controller.close();
      } catch (error) {
        const message = error instanceof Error ? error.message : "OpenAI request failed.";
        await appendLog(user, "error", "Falha ao gerar resposta", {
          chatId,
          model,
          error: message,
        }).catch(() => null);
        controller.error(error);
      }
    },
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

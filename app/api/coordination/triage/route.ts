import OpenAI from "openai";
import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";

export const runtime = "nodejs";

type CoordinationAgentProfile = {
  id: string;
  name: string;
  role?: string;
};

const DEFAULT_TRIAGE_MODEL = "gpt-4o-mini";
const MAX_INPUT_CHARS = 700;
const MAX_OUTPUT_TOKENS = 20;

function normalize(text: string) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function trimInput(text: string) {
  const trimmed = text.trim();
  if (trimmed.length <= MAX_INPUT_CHARS) return trimmed;
  return trimmed.slice(0, MAX_INPUT_CHARS);
}

function buildAgentList(agents: CoordinationAgentProfile[]) {
  return agents
    .map((agent) => {
      const role = agent.role ? ` — ${agent.role}` : "";
      return `- ${agent.id} (${agent.name})${role}`;
    })
    .join("\n");
}

function extractOutputText(response: Record<string, unknown>) {
  const direct = typeof response.output_text === "string" ? response.output_text : "";
  if (direct.trim()) return direct.trim();

  const output = Array.isArray(response.output) ? response.output : [];
  for (const item of output) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (record.type !== "message" || !Array.isArray(record.content)) continue;
    const content = record.content as Array<Record<string, unknown>>;
    const textItem = content.find((entry) => entry.type === "output_text" && typeof entry.text === "string");
    if (textItem && typeof textItem.text === "string" && textItem.text.trim()) {
      return textItem.text.trim();
    }
  }

  return "";
}

function matchAgentId(outputText: string, agents: CoordinationAgentProfile[]): string | null {
  if (!outputText) return null;
  const normalized = normalize(outputText);
  if (!normalized) return null;

  for (const agent of agents) {
    if (normalize(agent.id) === normalized) return agent.id;
    if (normalize(agent.name) === normalized) return agent.id;
  }

  for (const agent of agents) {
    const agentId = normalize(agent.id);
    const agentName = normalize(agent.name);
    if (agentId && normalized.includes(agentId)) return agent.id;
    if (agentName && normalized.includes(agentName)) return agent.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "OPENAI_API_KEY is not configured." }, { status: 500 });
  }

  const body = await request.json().catch(() => null);
  const input = typeof body?.input === "string" ? trimInput(body.input) : "";
  const agents = Array.isArray(body?.agents) ? (body.agents as CoordinationAgentProfile[]) : [];
  const previousAgentId = typeof body?.previousAgentId === "string" ? body.previousAgentId.trim() : "";

  if (!input || agents.length === 0) {
    return NextResponse.json({ agentId: null });
  }

  const agentList = buildAgentList(agents);
  const model = process.env.OPENAI_TRIAGE_MODEL?.trim() || DEFAULT_TRIAGE_MODEL;
  const systemPrompt =
    "Voce e um roteador de mensagens. Escolha APENAS um agent_id da lista. Se estiver em duvida, use o agente anterior. Retorne somente o agent_id, sem explicacoes.";
  const userPrompt = [
    `Mensagem do usuario: ${input}`,
    `Agentes disponiveis:\n${agentList}`,
    previousAgentId ? `Agente anterior: ${previousAgentId}` : "Agente anterior: nenhum",
  ].join("\n\n");

  const client = new OpenAI({ apiKey });
  let outputText = "";

  try {
    const response = await client.responses.create({
      model,
      input: [
        {
          role: "system",
          content: [{ type: "input_text", text: systemPrompt }],
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      max_output_tokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    });

    outputText = extractOutputText(response as unknown as Record<string, unknown>);
  } catch (error) {
    console.error("[Coordination Triage] OpenAI error:", error);
    return NextResponse.json({ agentId: null });
  }

  const matchedAgentId = matchAgentId(outputText, agents);
  return NextResponse.json({ agentId: matchedAgentId });
}

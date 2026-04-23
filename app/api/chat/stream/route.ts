import crypto from "node:crypto";
import { NextRequest } from "next/server";

import type { SessionUser } from "@/lib/server/auth";
import { hasDatabase } from "@/lib/server/db";
import type { ChatMessage } from "@/lib/server/store";
import { 
  appendConversationMessages, 
  readAppSettings, 
  getConversationById 
} from "@/lib/server/store";
import { requireUser } from "@/lib/server/request";
import { getUserProfile } from "@/lib/server/memory/repository";
import { orchestrateMemoryCandidates } from "@/lib/server/memory/orchestrator";
import { extractMemoryCandidates } from "@/lib/server/memory/extract-memory-candidates";
import { isMemoryOrchestratorEnabled } from "@/lib/server/memory/flags";
import { buildContextPack } from "@/lib/server/memory/context-builder";
import { extractImageMemoryCandidates } from "@/lib/server/memory/image-extractor";
import { streamAgent, triageAgent } from "@/lib/agent/llm";
import { initializePersistentState } from "@/lib/agent/initialization";
import { AGENT_PROFILES } from "@/lib/familyRouting";
import { getPsychologicalProfile } from "@/lib/server/psychological-profile";

export const runtime = "nodejs";

const encoder = new TextEncoder();

function encodeEvent(event: string, data: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

async function persistAssistantReply(
  user: SessionUser,
  chatId: string,
  prompt: string,
  previousMessages: ChatMessage[],
  assistantOutput: string,
  agentId: string | null,
  agentName: string | null,
  attachments: ChatMessage["attachments"] = [],
) {
  if (!chatId) {
    return { userMessageId: null, assistantMessageId: null };
  }

  const userReply: ChatMessage = {
    role: "user",
    content: prompt,
    attachments,
  };

  const assistantReply: ChatMessage = {
    role: "agent",
    content: assistantOutput,
    agentId: agentId || undefined,
  };

  const { insertedMessageIds } = await appendConversationMessages(user, chatId, prompt, [userReply, assistantReply], agentId);

  return {
    userMessageId: insertedMessageIds?.[0] || null,
    assistantMessageId: insertedMessageIds?.[1] || null,
  };
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
  attachments?: ChatMessage["attachments"];
}) {
  if (!isMemoryOrchestratorEnabled()) return;
  if (!hasDatabase()) return;
  
  const profile = await getUserProfile(params.user.id).catch(() => null);
  const currentProfileSummary = profile?.summaryShort || "";

  const { candidates, stats } = await extractMemoryCandidates({
    input: {
      sourceConversationId: params.chatId,
      sourceMessageId: params.sourceMessageId,
      userPrompt: params.prompt,
      recentUserTexts: params.recentUserTexts,
      createdBy: "unified_agent_swarm_v2",
      currentProfileSummary,
    },
    apiKey: params.apiKey,
    llmModel: process.env.OPENAI_MEMORY_EXTRACTION_MODEL?.trim() || params.model,
    maxTotalCandidates: 5,
    maxLlmAccepted: 3,
  });

  const imageAttachments = params.attachments?.filter(a => a.mimeType?.startsWith("image/") || /\.(png|jpg|jpeg|webp)$/i.test(a.name)) || [];
  
  if (imageAttachments.length > 0) {
    for (const attachment of imageAttachments) {
      if (!attachment.content) continue;
      try {
        const { candidates: imageCandidates } = await extractImageMemoryCandidates({
          apiKey: params.apiKey,
          model: "gpt-4o-mini",
          input: {
            sourceConversationId: params.chatId,
            sourceMessageId: params.sourceMessageId,
            userPrompt: params.prompt,
            imageUrl: attachment.content,
          },
        });
        if (imageCandidates.length > 0) candidates.push(...imageCandidates);
      } catch (err) {
        console.warn("[MemoryOrchestrator] Image extraction failed:", err);
      }
    }
  }

  if (candidates.length === 0) return;

  try {
    await orchestrateMemoryCandidates({
      userId: params.user.id,
      candidates: candidates.map((candidate) => ({ id: crypto.randomUUID(), ...candidate })),
      actor: params.actor,
      reason: "unified_chat_stream_auto",
      compileProfile: true,
    });
  } catch (error) {
    console.warn("[MemoryOrchestrator] orchestration failed:", error);
  }
}

let isAgentInitialized = false;
async function ensureAgentInitialized() {
  if (isAgentInitialized) return;
  try {
    await initializePersistentState();
    isAgentInitialized = true;
  } catch (err) {
    console.error("[AgentInit] Failed to initialize agent state:", err);
  }
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) return new Response("Unauthorized", { status: 401 });

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) return new Response("OPENAI_API_KEY not set", { status: 500 });

  const settings = await readAppSettings();
  const body = await request.json().catch(() => null);
  const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
  const requestedAgentId = typeof body?.selectedAgentId === "string" ? body.selectedAgentId.trim() : null;
  const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : [];
  
  const chat = chatId ? await getConversationById(user, chatId).catch(() => null) : null;
  const lastAgentId = [...messages].reverse().find(m => m?.role === "agent" && m.agentId)?.agentId ?? null;

  const lastUserMessage = [...messages].reverse().find(m => m?.role === "user");
  const prompt = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
  const attachments = lastUserMessage?.attachments || [];

  if (!prompt && attachments.length === 0) return new Response("User message required", { status: 400 });

  // 🚀 Swarm Triage: Determine which agent should respond
  const currentContextId = requestedAgentId || chat?.activeAgent || lastAgentId || 'chocks';
  let selectedAgentId = currentContextId;

  // We triage to check if the user is explicitly calling someone else
  const agentsForTriage = Object.entries(AGENT_PROFILES).map(([id, p]) => ({
    id,
    name: p.name,
    role: p.role,
    aliases: p.aliases,
    expertise: p.expertise,
    keywords: p.keywords
  }));

  try {
    const triage = await triageAgent({
      input: prompt,
      agents: agentsForTriage,
      previousAgentId: currentContextId
    });

    // If triage found a specific agent and it's different from the current one, switch!
    if (triage.agentId && triage.agentId !== currentContextId) {
      selectedAgentId = triage.agentId as string;
    }
  } catch (err) {
    console.warn("[Triage] Failed, falling back to current context:", err);
  }

  const selectedAgentName = (AGENT_PROFILES as Record<string, { name: string }>)[selectedAgentId]?.name || selectedAgentId;

  const readable = new ReadableStream<Uint8Array>({
    start: async (controller) => {
      await ensureAgentInitialized();
      
      try {
        const [psychProfile, memoryContext] = await Promise.all([
          getPsychologicalProfile(user.id).catch(() => null),
          isMemoryOrchestratorEnabled() && settings.memoryMode !== "off"
            ? buildContextPack({
                userId: user.id,
                agentType: selectedAgentId,
                taskType: "chat",
                limitItems: 12,
                query: prompt,
              }).catch(() => null)
            : Promise.resolve(null),
        ]);

        const agentMessages = messages.map((m) => ({
          role: m.role === "agent" ? "assistant" : (m.role as "user" | "assistant" | "system" | "tool"),
          content: m.content,
        }));

        const result = await streamAgent(agentMessages, {
          chatId,
          userId: user.id,
          displayName: user.displayName,
          fullAccess: settings.fullAccess,
          permissionMode: settings.permissionMode,
          latestUserMessage: prompt,
          selectedAgentId,
          memoryContext,
          psychProfile
        }, {
          onTextDelta: (delta) => controller.enqueue(encodeEvent("text-delta", { delta })),
          onTrace: (entry) => controller.enqueue(encodeEvent("trace", entry))
        });

        const persisted = await persistAssistantReply(
          user,
          chatId,
          prompt, // This is the clean user input string
          messages,
          result.response.output_text,
          selectedAgentId,
          selectedAgentName,
          attachments
        );

        const sourceMessageId = (() => {
          const parsed = Number(persisted.userMessageId);
          return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
        })();
        
        const recentUserTexts = messages
          .filter(m => m?.role === "user" && typeof m.content === "string")
          .map(m => m.content as string)
          .slice(0, -1);

        if (isMemoryOrchestratorEnabled()) {
          void maybeAutoCaptureMemoryOrchestrator({
            user,
            chatId,
            prompt,
            recentUserTexts,
            sourceMessageId,
            apiKey,
            model: process.env.OPENAI_MODEL || 'gpt-4o',
            actor: selectedAgentName,
            attachments,
          }).catch(() => null);
        }

        controller.enqueue(encodeEvent("done", {
          output_text: result.response.output_text,
          trace: result.trace,
          messageId: persisted.assistantMessageId,
          agentId: selectedAgentId,
          agentName: selectedAgentName,
          model: "agent-swarm-v2"
        }));
      } catch (err) {
        console.error("[ChatStreamV2] Error:", err);
        controller.enqueue(encodeEvent("error", { message: String(err) }));
      } finally {
        controller.close();
      }
    }
  });

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

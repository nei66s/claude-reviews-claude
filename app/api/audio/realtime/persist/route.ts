import crypto from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/server/request";
import {
  appendConversationMessages,
  appendLog,
  type ChatMessage,
} from "@/lib/server/store";
import { isMemoryOrchestratorEnabled } from "@/lib/server/memory/flags";
import { extractMemoryCandidates } from "@/lib/server/memory/extract-memory-candidates";
import { orchestrateMemoryCandidates } from "@/lib/server/memory/orchestrator";
import { dbQuery, hasDatabase } from "@/lib/server/db";

export const runtime = "nodejs";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface PersistRealtimeTurnRequest {
  /** ID da conversa — obrigatório */
  chatId: string;
  /** Título atual da conversa */
  title?: string;
  /** Transcrição final do usuário (Whisper in-line do Realtime) */
  userTranscript: string;
  /** Texto consolidado da resposta do assistant */
  assistantText: string;
  /** ID do agente que respondeu */
  agentId?: string;
  /** Usado para deduplicação — o frontend gera um UUID por turno */
  correlationId?: string;
}

// ─── Deduplicação leve (in-memory fallback para ambiente sem DB) ──────────────

/**
 * Guarda correlationIds já processados para fallback se não houver Postgres.
 */
const fallbackProcessedCorrelations = new Map<string, number>();
const MAX_CORRELATION_CACHE = 500;

function isFallbackDuplicate(correlationId: string | undefined): boolean {
  if (!correlationId) return false;
  return fallbackProcessedCorrelations.has(correlationId);
}

function markFallbackProcessed(correlationId: string | undefined): void {
  if (!correlationId) return;
  if (fallbackProcessedCorrelations.size >= MAX_CORRELATION_CACHE) {
    const oldestKey = fallbackProcessedCorrelations.keys().next().value;
    if (oldestKey) fallbackProcessedCorrelations.delete(oldestKey);
  }
  fallbackProcessedCorrelations.set(correlationId, Date.now());
}

// ─── Transaction Helper ───────────────────────────────────────────────────────
// Função helper para a tabela `realtime_turns` que garante o lock de idempotência
async function acquireIdempotencyLock(chatId: string, userId: string, correlationId: string): Promise<boolean> {
  if (!hasDatabase()) {
    if (isFallbackDuplicate(correlationId)) return false; // Duplicate
    markFallbackProcessed(correlationId);
    return true; // OK
  }

  try {
    // 1. Garantir existência da tabela Option A
    await dbQuery(`
      CREATE TABLE IF NOT EXISTS public.realtime_turns (
        id SERIAL PRIMARY KEY,
        user_id TEXT NOT NULL,
        chat_id TEXT NOT NULL,
        correlation_id TEXT UNIQUE NOT NULL,
        created_at TIMESTAMP DEFAULT NOW()
      );
    `);

    // 2. Tentar inserir. Se já existir, a UNIQUE constraint abortará a query
    await dbQuery(
      `INSERT INTO public.realtime_turns (user_id, chat_id, correlation_id) VALUES ($1, $2, $3)`,
      [userId, chatId, correlationId]
    );
    
    return true; // Lock acquired successfully
  } catch (err) {
    const error = err as { code?: string; message?: string };
    if (error.code === "23505" || error.message?.includes("UNIQUE constraint")) {
      return false; // Duplicate lock
    }
    throw err;
  }
}

async function releaseIdempotencyLockOnFailure(correlationId: string) {
  if (hasDatabase()) {
    try {
      await dbQuery(`DELETE FROM public.realtime_turns WHERE correlation_id = $1`, [correlationId]);
    } catch {
      // Best effort release
    }
  } else {
    fallbackProcessedCorrelations.delete(correlationId);
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────


export async function POST(req: NextRequest) {
  // 1. Autenticação — apenas usuários autenticados persistem
  const user = requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: PersistRealtimeTurnRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Body inválido" }, { status: 400 });
  }

  const {
    chatId,
    title = "Conversa de voz",
    userTranscript,
    assistantText,
    agentId = "chocks",
    correlationId,
  } = body;

  // 2. Validações mínimas
  if (!chatId?.trim()) {
    return NextResponse.json({ error: "chatId é obrigatório" }, { status: 400 });
  }

  if (!userTranscript?.trim() && !assistantText?.trim()) {
    return NextResponse.json(
      { error: "userTranscript ou assistantText são necessários" },
      { status: 400 }
    );
  }

  // 3. Barrier: Idempotência Atômica via DB/Cache
  // Só bloqueamos se o correlationId explicitamente vier do frontend (V2 turnId)
  if (correlationId) {
    const lockAcquired = await acquireIdempotencyLock(chatId, user.id, correlationId);
    if (!lockAcquired) {
      await appendLog(user, "info", "[Realtime] Turno duplicado rejeitado pelo lock", {
        chatId,
        correlationId,
      });
      return NextResponse.json({ skipped: true, reason: "duplicate_idempotent_lock" });
    }
  }

  // 4. Montar mensagens oficiais
  //    Metadados de rastreabilidade: inputMethod e transport marcam a origem corretamente
  const messagesToPersist: ChatMessage[] = [];

  if (userTranscript?.trim()) {
    messagesToPersist.push({
      role: "user",
      content: userTranscript.trim(),
      // Campos extras de rastreabilidade — aceitos pelo store como unknown extension
      ...(({
        inputMethod: "realtime_voice",
        transport: "realtime",
        correlationId,
      } as unknown) as Partial<ChatMessage>),
    });
  }

  if (assistantText?.trim()) {
    messagesToPersist.push({
      role: "agent",
      content: assistantText.trim(),
      agentId,
      ...(({
        inputMethod: "realtime_voice",
        transport: "realtime",
        correlationId,
      } as unknown) as Partial<ChatMessage>),
    });
  }

  if (messagesToPersist.length === 0) {
    return NextResponse.json({ skipped: true, reason: "empty_messages" });
  }

  let insertedMessageIds: string[] = [];
  try {
    const result = await appendConversationMessages(
      user,
      chatId,
      title,
      messagesToPersist,
      agentId
    );
    insertedMessageIds = result.insertedMessageIds;
  } catch (persistError) {
    if (correlationId) {
      await releaseIdempotencyLockOnFailure(correlationId);
    }
    console.error("[Realtime] Falha na persistência:", persistError);
    await appendLog(user, "error", "[Realtime] Falha ao persistir turno", {
      chatId,
      correlationId,
      error: persistError instanceof Error ? persistError.message : String(persistError),
    });
    return NextResponse.json(
      { error: "Falha ao salvar a conversa. O turno pode ser repetido." },
      { status: 500 }
    );
  }

  // 6. Memory Orchestrator — exatamente o mesmo pipeline da V1
  //    Nunca bypassado, nunca chamado diretamente pelo cliente
  if (isMemoryOrchestratorEnabled() && userTranscript?.trim() && assistantText?.trim()) {
    // Roda em background — não bloqueia a resposta HTTP
    setImmediate(async () => {
      try {
        const conversationId = chatId;
        const userMessageId = insertedMessageIds[0] ? Number(insertedMessageIds[0]) : null;

        const { candidates } = await extractMemoryCandidates({
          input: {
            sourceConversationId: conversationId,
            sourceMessageId: userMessageId,
            userPrompt: `${userTranscript.trim()}\n\n${assistantText.trim()}`,
            createdBy: "realtime_persist",
          },
          apiKey: process.env.OPENAI_API_KEY?.trim(),
          llmModel: "gpt-4o-mini",
        });

        if (candidates.length > 0) {
          await orchestrateMemoryCandidates({
            userId: user.id,
            candidates: candidates.map(c => ({ id: crypto.randomUUID(), ...c })),
            actor: "realtime_persist",
            reason: `realtime_voice_turn:${correlationId ?? crypto.randomUUID()}`,
          });
        }

        await appendLog(user, "info", "[Realtime] Memória orquestrada pós-turno", {
          chatId,
          candidateCount: candidates.length,
        });
      } catch (memError) {
        console.error("[Realtime] Falha na orquestração de memória:", memError);
        await appendLog(user, "warn", "[Realtime] Falha na orquestração de memória", {
          chatId,
          error: memError instanceof Error ? memError.message : String(memError),
        });
      }
    });
  }

  // 7. Log de auditoria
  await appendLog(user, "info", "[Realtime] Turno persistido com sucesso", {
    chatId,
    agentId,
    correlationId,
    userLen: userTranscript?.length ?? 0,
    assistantLen: assistantText?.length ?? 0,
    insertedIds: insertedMessageIds,
  });

  return NextResponse.json({
    ok: true,
    userMessageId: insertedMessageIds[0] ?? null,
    agentMessageId: insertedMessageIds[1] ?? null,
    correlationId,
  });
}

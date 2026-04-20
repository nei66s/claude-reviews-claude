import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/server/request";
import { appendLog } from "@/lib/server/store";
import { buildContextPack } from "@/lib/server/memory/context-builder";

export const runtime = "nodejs";

// ─── Tipos ────────────────────────────────────────────────────────────────────

interface RealtimeSessionRequest {
  chatId?: string;
  agentId?: string;
  /** Voz Realtime a usar. Padrão: "shimmer" (alinhado à voz da V1 TTS). */
  voice?: "alloy" | "ash" | "ballad" | "coral" | "echo" | "sage" | "shimmer" | "verse";
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function POST(req: NextRequest) {
  // 1. Autenticação obrigatória — chave da OpenAI nunca vai ao cliente
  const user = requireUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // 2. Feature flag — garante que a rota só opera se Realtime estiver habilitado
  if (process.env.NEXT_PUBLIC_ENABLE_REALTIME_VOICE !== "true") {
    return NextResponse.json(
      { error: "Realtime voice is not enabled on this server." },
      { status: 403 }
    );
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
  }

  let body: RealtimeSessionRequest = {};
  try {
    body = await req.json();
  } catch {
    // body vazio é permitido — todos os campos têm defaults
  }

  const chatId = body.chatId || "unknown";
  const agentId = body.agentId || "chocks";
  const voice = body.voice || "shimmer";

  // 3. Construir contexto de memória para injetar na sessão
  //    O context pack é o mesmo da cadeia textual — não abrimos exceção para o canal de voz
  let injectedContext = "";
  try {
    const contextPack = await buildContextPack({ userId: user.id });

    const parts: string[] = [];

    if (contextPack.summaryShort) {
      parts.push(`Perfil do usuário: ${contextPack.summaryShort}`);
    }

    if (contextPack.memoryItems && contextPack.memoryItems.length > 0) {
      const memLines = contextPack.memoryItems
        .slice(0, 10)
        .map((m) => `- ${m.content}`)
        .join("\n");
      parts.push(`Memórias estruturadas:\n${memLines}`);
    }

    injectedContext = parts.join("\n\n");
  } catch (contextError) {
    // Contexto é opcional — a sessão continua sem ele
    console.warn("[Realtime] Falha ao construir context pack:", contextError);
  }

  // 4. System prompt composto com contexto injetado
  //    Mínimo necessário — as instruções completas ficam na chain textual oficial
  const systemPrompt = [
    "Você é Chocks, assistente de voz. Responda de forma natural, concisa e em português do Brasil.",
    "Você está em uma conversa de voz ao vivo — seja direto, sem formatação markdown.",
    `Agente ativo: ${agentId}.`,
    injectedContext ? `\n--- Contexto do usuário ---\n${injectedContext}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // 5. Criar sessão Realtime — apenas o backend toca na chave OpenAI
  try {
    const openai = new OpenAI({ apiKey });

    // A OpenAI Realtime API retorna um client_secret ephemeral para uso no browser
    // @ts-expect-error — o SDK pode não ter tipagem completa para realtime.sessions.create
    const session = await (openai as unknown as { beta: { realtime: { sessions: { create: (params: Record<string, unknown>) => Promise<{ id: string; client_secret: string }> } } } }).beta.realtime.sessions.create({
      model: "gpt-4o-realtime-preview",
      voice,
      instructions: systemPrompt,
      input_audio_transcription: {
        model: "whisper-1",
      },
      turn_detection: {
        type: "server_vad",
        threshold: 0.5,
        prefix_padding_ms: 300,
        silence_duration_ms: 600,
      },
      // Sem ferramentas exposta no Realtime — lógica de negócio fica na chain textual
      tools: [],
    });

    await appendLog(user, "info", "[Realtime] Sessão criada", {
      chatId,
      agentId,
      voice,
      sessionId: session?.id,
    });

    // 6. Devolver ao cliente APENAS o necessário para abrir a conexão WebRTC
    //    Nunca devolver apiKey ou dados internos
    return NextResponse.json({
      sessionId: session?.id,
      clientSecret: session?.client_secret,
      voice,
      model: "gpt-4o-realtime-preview",
    });
  } catch (error) {
    console.error("[Realtime] Erro ao criar sessão:", error);
    await appendLog(user, "error", "[Realtime] Falha ao criar sessão", {
      chatId,
      agentId,
      error: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Falha ao criar sessão Realtime. Tente novamente ou use a entrada por texto." },
      { status: 500 }
    );
  }
}

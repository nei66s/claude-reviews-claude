import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import OpenAI from "openai";
import { NextRequest } from "next/server";

import type { ChatMessage } from "@/app/lib/server/store";
import { appendLog, readAppSettings, upsertConversation } from "@/app/lib/server/store";
import { requireUser } from "@/app/lib/server/request";
import { chatToolDefinitions, runChatTool } from "@/app/lib/server/chat-tools";
import { listFileEntries } from "@/app/lib/server/files";

export const runtime = "nodejs";

const encoder = new TextEncoder();
const DEFAULT_MODEL = "gpt-5";
const DEFAULT_REASONING_EFFORT = "low";
const DEFAULT_TEXT_VERBOSITY = "low";
const DEFAULT_MAX_OUTPUT_TOKENS = 220;
const MAX_TOOL_LOOPS = 6;
const BASE_INSTRUCTIONS = `
Responda em portugues do Brasil, com objetividade e sem rodeios.
Use tools quando elas ajudarem materialmente.
Se o pedido envolver arquivos, workflow ou inspeção do workspace, prefira agir com tools em vez de responder de forma vaga.
Quando usar workflow, mantenha as etapas curtas e operacionais.
`.trim();
const LOCAL_SMALL_TALK_REPLY = "Tudo certo. Como posso ajudar?";

function encodeEvent(event: string, payload: unknown) {
  return encoder.encode(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`);
}

function parsePositiveInt(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
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

function isSmallTalkPrompt(prompt: string, previousAssistantText: string) {
  const normalized = normalizePrompt(prompt);
  if (!normalized || normalized.length > 80 || normalized.includes("\n")) {
    return false;
  }

  if (isConfirmationReply(prompt, previousAssistantText)) {
    return false;
  }

  const directMatches = new Set([
    "oi",
    "oii",
    "ola",
    "olaa",
    "opa",
    "e ai",
    "ei",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "td bem",
    "blz",
    "beleza",
    "ok",
    "valeu",
    "obrigado",
    "obrigada",
    "e voce",
    "como vai",
    "como voce esta",
  ]);

  if (directMatches.has(normalized)) {
    return true;
  }

  const smallTalkTerms = [
    "oi",
    "ola",
    "opa",
    "e ai",
    "bom dia",
    "boa tarde",
    "boa noite",
    "tudo bem",
    "td bem",
    "blz",
    "beleza",
    "e voce",
    "vc",
    "voce",
    "como vai",
    "como voce esta",
    "valeu",
    "obrigado",
    "obrigada",
    "ok",
  ];

  const matchedTerms = smallTalkTerms.filter((term) => normalized.includes(term));
  return matchedTerms.length > 0 && normalized.split(" ").length <= 8;
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
) {
  if (!chatId) return;

  await upsertConversation(user, {
    id: chatId,
    title: prompt.slice(0, 30) || "Nova conversa",
    messages: [...messages, { role: "agent", content: reply, streaming: false }],
  });
}

function toModelInput(messages: ChatMessage[]): OpenAI.Responses.ResponseInput {
  return messages
    .filter((message) => typeof message.content === "string" && message.content.trim())
    .map((message) => ({
      type: "message" as const,
      role: message.role === "agent" ? ("assistant" as const) : ("user" as const),
      content: [
        message.role === "agent"
          ? {
              type: "output_text" as const,
              text: message.content,
            }
          : {
              type: "input_text" as const,
              text: message.content,
            },
      ],
    })) as OpenAI.Responses.ResponseInput;
}

function buildInstructions(fullAccess: boolean, permissionMode: string) {
  return `${BASE_INSTRUCTIONS}

Filesystem mode: ${fullAccess ? "full computer access enabled by the user" : "restricted to current workspace"}.
Permission mode: ${permissionMode}.`;
}

async function createResponseStream(
  apiKey: string,
  body: Record<string, unknown>,
  onTextDelta: (delta: string) => void,
) {
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ ...body, stream: true }),
  });

  if (!response.ok || !response.body) {
    const text = await response.text();
    throw new Error(`Responses stream failed: ${response.status} ${text}`);
  }

  let buffer = "";
  let completedResponse: Record<string, unknown> | null = null;

  const reader = response.body.getReader();
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += Buffer.from(value).toString("utf8");

    while (buffer.includes("\n\n")) {
      const boundary = buffer.indexOf("\n\n");
      const rawEvent = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);

      const lines = rawEvent.split("\n");
      const dataLines = lines
        .filter((line) => line.startsWith("data:"))
        .map((line) => line.slice(5).trim());

      if (dataLines.length === 0) continue;

      const data = dataLines.join("\n");
      if (data === "[DONE]") continue;

      try {
        const payload = JSON.parse(data) as { type?: string; delta?: string; response?: Record<string, unknown> };
        if (payload.type === "response.output_text.delta" && typeof payload.delta === "string") {
          onTextDelta(payload.delta);
        }
        if (payload.type === "response.completed" && payload.response) {
          completedResponse = payload.response;
        }
      } catch {
        continue;
      }
    }
  }

  if (!completedResponse) {
    throw new Error("No completed response received from stream");
  }

  return completedResponse as {
    id: string;
    output?: Array<{
      type: string;
      name?: string;
      call_id?: string;
      arguments?: string;
    }>;
    output_text?: string;
  };
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
  const messages = Array.isArray(body?.messages) ? (body.messages as ChatMessage[]) : [];
  const previousAssistantText = getPreviousAssistantText(messages);
  const lastUserMessage = [...messages]
    .reverse()
    .find((message) => message?.role === "user" && typeof message?.content === "string");
  const prompt = typeof lastUserMessage?.content === "string" ? lastUserMessage.content : "";
  const isSmallTalk = isSmallTalkPrompt(prompt, previousAssistantText);

  if (!prompt) {
    return new Response("A user message is required.", { status: 400 });
  }

  const startedAt = Date.now();
  const directDesktopResult = await getDirectDesktopResult(prompt, previousAssistantText);

  if (directDesktopResult) {
    await persistAssistantReply(user, chatId, prompt, messages, directDesktopResult.outputText);
    await appendLog(user, "info", "Listagem direta da Área de Trabalho", {
      chatId,
      fullAccess: settings.fullAccess,
      totalMs: Date.now() - startedAt,
    }).catch(() => null);

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const traceEntry of directDesktopResult.trace) {
          controller.enqueue(encodeEvent("trace", traceEntry));
        }
        controller.enqueue(encodeEvent("text-delta", { delta: directDesktopResult.outputText }));
        controller.enqueue(
          encodeEvent("done", {
            output_text: directDesktopResult.outputText,
            trace: directDesktopResult.trace,
            model: "direct-desktop-list",
          }),
        );
        controller.close();
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

  if (isSmallTalk) {
    const finalText = LOCAL_SMALL_TALK_REPLY;
    const trace = [
      {
        type: "model",
        label: "Resposta local",
        state: "complete",
        subtitle: "Fluxo curto para small talk.",
        payload: {
          model: "local-small-talk",
          totalMs: Date.now() - startedAt,
        },
      },
    ];

    await persistAssistantReply(user, chatId, prompt, messages, finalText);

    const readable = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encodeEvent("trace", trace[0]));
        controller.enqueue(encodeEvent("text-delta", { delta: finalText }));
        controller.enqueue(encodeEvent("done", { output_text: finalText, trace, model: "local-small-talk" }));
        controller.close();
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

  const modelInput = toModelInput(messages);

  const readable = new ReadableStream<Uint8Array>({
    async start(controller) {
      let finalText = "";
      let firstTokenAt: number | null = null;
      const traceEntries: unknown[] = [];

      try {
        controller.enqueue(
          encodeEvent("trace", {
            type: "model",
            label: "OpenAI Responses",
            state: "pending",
            subtitle: "Preparando resposta com tool calls.",
            payload: {
              model,
              reasoningEffort,
              textVerbosity,
              maxOutputTokens,
              fullAccess: settings.fullAccess,
              permissionMode: settings.permissionMode,
            },
          }),
        );

        let response = await createResponseStream(
          apiKey,
          {
            model,
            instructions: buildInstructions(settings.fullAccess, settings.permissionMode),
            input: modelInput,
            tools: chatToolDefinitions,
            parallel_tool_calls: false,
            max_output_tokens: maxOutputTokens,
            reasoning: {
              effort: reasoningEffort,
            },
            text: {
              verbosity: textVerbosity,
            },
          },
          (delta) => {
            if (!firstTokenAt) {
              firstTokenAt = Date.now();
            }
            finalText += delta;
            controller.enqueue(encodeEvent("text-delta", { delta }));
          },
        );

        for (let loop = 0; loop < MAX_TOOL_LOOPS; loop += 1) {
          const toolCalls = Array.isArray(response.output)
            ? response.output.filter((item) => item.type === "function_call")
            : [];

          if (toolCalls.length === 0) {
            break;
          }

          const toolOutputs: Array<{ type: "function_call_output"; call_id: string; output: string }> = [];

          for (const call of toolCalls) {
            const callId = typeof call.call_id === "string" ? call.call_id : crypto.randomUUID();
            const toolName = typeof call.name === "string" ? call.name : "unknown_tool";
            const rawArguments = typeof call.arguments === "string" ? call.arguments : "{}";

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
              toolOutputs.push({ type: "function_call_output", call_id: callId, output });
              continue;
            }

            try {
              const result = await runChatTool(user, chatId, toolName, parsedArgs);
              const output = JSON.stringify({ ok: true, output: result });
              const outputTrace = {
                type: "tool_call",
                label: toolName,
                state: "complete",
                subtitle: "Tool executada com sucesso.",
                payload: { callId, output: result },
              };
              traceEntries.push(outputTrace);
              controller.enqueue(encodeEvent("trace", outputTrace));
              toolOutputs.push({ type: "function_call_output", call_id: callId, output });
            } catch (error) {
              const output = JSON.stringify({
                ok: false,
                error: error instanceof Error ? error.message : String(error),
              });
              const outputTrace = {
                type: "tool_call",
                label: toolName,
                state: "error",
                subtitle: "Tool retornou erro.",
                payload: { callId, output: JSON.parse(output) },
              };
              traceEntries.push(outputTrace);
              controller.enqueue(encodeEvent("trace", outputTrace));
              toolOutputs.push({ type: "function_call_output", call_id: callId, output });
            }
          }

          response = await createResponseStream(
            apiKey,
            {
              model,
              previous_response_id: response.id,
              input: toolOutputs,
            },
            (delta) => {
              if (!firstTokenAt) {
                firstTokenAt = Date.now();
              }
              finalText += delta;
              controller.enqueue(encodeEvent("text-delta", { delta }));
            },
          );
        }

        if (!finalText && typeof response.output_text === "string") {
          finalText = response.output_text;
        }

        await persistAssistantReply(user, chatId, prompt, messages, finalText);
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

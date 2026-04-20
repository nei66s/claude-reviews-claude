import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/server/request";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    if (!user) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return new NextResponse("API Key não configurada", { status: 500 });
    }

    const body = await req.json();
    const text = body.text?.trim();
    const chatId = body.chatId || "unknown";

    if (!text) {
      return new NextResponse("Texto vazio", { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // alloy, echo, fable, onyx, nova, shimmer
    const mp3 = await openai.audio.speech.create({
      model: "tts-1",
      voice: "shimmer", // Shimmer é a opção nativamente mais alta e mecanicista/fina da OpenAI
      input: text,
      response_format: "mp3",
    });

    const buffer = await mp3.arrayBuffer();

    await appendLog(user, "info", "Áudio TTS gerado", {
      chatId,
      textLen: text.length,
      audioBytes: buffer.byteLength,
    });

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "audio/mpeg",
      },
    });
  } catch (error) {
    console.error("[TTS Error]", error);
    return new NextResponse("Falha na geração de TTS", { status: 500 });
  }
}

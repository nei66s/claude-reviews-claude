import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { requireUser } from "@/lib/server/request";
import { appendLog } from "@/lib/server/store";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const user = requireUser(req);
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json({ error: "API Key não configurada" }, { status: 500 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const chatId = formData.get("chatId") as string | null;

    if (!file) {
      return NextResponse.json({ error: "Nenhum arquivo enviado" }, { status: 400 });
    }

    const openai = new OpenAI({ apiKey });

    // Send to whisper
    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: "whisper-1",
      language: "pt", // force portuguese for better context if mostly PT
    });

    // Logging for persistence & audit
    await appendLog(user, "info", "Áudio transcrito via Whisper", {
      chatId,
      textLen: transcription.text.length,
      fileBytes: file.size,
    });

    return NextResponse.json({ text: transcription.text });
  } catch (error) {
    console.error("[Transcription Error]", error);
    return NextResponse.json({ error: "Falha na transcrição" }, { status: 500 });
  }
}

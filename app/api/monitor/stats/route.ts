import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";

interface OpenAIStats {
  configured: boolean;
  keyMasked: string | null;
  online: boolean;
  modelCount: number | null;
  latencyMs: number | null;
  defaultModel: string | null;
}

async function fetchOpenAIStats(): Promise<OpenAIStats> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  const defaultModel = process.env.OPENAI_MODEL ?? null;

  if (!apiKey) {
    return { configured: false, keyMasked: null, online: false, modelCount: null, latencyMs: null, defaultModel };
  }

  const keyMasked = `${apiKey.slice(0, 7)}...${apiKey.slice(-4)}`;
  const t0 = Date.now();

  try {
    const res = await fetch("https://api.openai.com/v1/models", {
      headers: { Authorization: `Bearer ${apiKey}` },
      signal: AbortSignal.timeout(8000),
    });

    const latencyMs = Date.now() - t0;

    if (!res.ok) {
      return { configured: true, keyMasked, online: false, modelCount: null, latencyMs, defaultModel };
    }

    const body = (await res.json()) as { data?: unknown[] };
    return {
      configured: true,
      keyMasked,
      online: true,
      modelCount: Array.isArray(body.data) ? body.data.length : null,
      latencyMs,
      defaultModel,
    };
  } catch {
    return { configured: true, keyMasked, online: false, modelCount: null, latencyMs: Date.now() - t0, defaultModel };
  }
}

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const [openai] = await Promise.all([fetchOpenAIStats()]);

  return NextResponse.json({
    memory: process.memoryUsage(),
    uptime: process.uptime(),
    now: Date.now(),
    openai,
  });
}


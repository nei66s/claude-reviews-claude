import { NextRequest, NextResponse } from "next/server";

import { isDatabaseBusyError } from "@/lib/server/db";
import { getMemoryAuditSummary, listMemoryAuditEvents } from "@/lib/server/memory/repository";
import { requireUser } from "@/lib/server/request";

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 50;
  return Math.max(1, Math.min(200, Math.floor(parsed)));
}

export async function GET(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id } = await context.params;
  const userId = String(id || "").trim();
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (session.id !== "local-admin" && session.id !== userId) {
    return NextResponse.json({ error: "Proibido." }, { status: 403 });
  }

  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));
  const memoryItemId = request.nextUrl.searchParams.get("memoryItemId")?.trim() || "";

  try {
    const [summary, events] = await Promise.all([
      getMemoryAuditSummary(userId),
      listMemoryAuditEvents(userId, { limit, memoryItemId: memoryItemId || undefined }),
    ]);
    const response = NextResponse.json({ userId, summary, events });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao listar auditoria." },
      { status: 500 },
    );
  }
}


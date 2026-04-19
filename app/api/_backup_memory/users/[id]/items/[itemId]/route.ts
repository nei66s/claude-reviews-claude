import { NextRequest, NextResponse } from "next/server";

import { isDatabaseBusyError } from "@/lib/server/db";
import { MEMORY_ITEM_STATUSES } from "@/lib/server/memory/constants";
import type { MemoryItemStatus } from "@/lib/server/memory/types";
import { applyManualMemoryItemChange } from "@/lib/server/memory/orchestrator";
import { requireUser } from "@/lib/server/request";

type PatchBody = {
  status?: unknown;
  content?: unknown;
  normalizedValue?: unknown;
  category?: unknown;
  reason?: unknown;
};

function parseStatus(value: unknown): MemoryItemStatus | undefined {
  if (value === undefined || value === null) return undefined;
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  return (MEMORY_ITEM_STATUSES as readonly string[]).includes(raw) ? (raw as MemoryItemStatus) : undefined;
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string; itemId: string }> },
) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const { id, itemId } = await context.params;
  const userId = String(id || "").trim();
  const memoryItemId = String(itemId || "").trim();

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!memoryItemId) {
    return NextResponse.json({ error: "itemId required" }, { status: 400 });
  }

  if (session.id !== "local-admin" && session.id !== userId) {
    return NextResponse.json({ error: "Proibido." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as PatchBody | null;
  const status = parseStatus(body?.status);
  const content = typeof body?.content === "string" ? body.content : undefined;
  const normalizedValue = typeof body?.normalizedValue === "string" ? body.normalizedValue : undefined;
  const category = typeof body?.category === "string" ? body.category : undefined;
  const reason = typeof body?.reason === "string" ? body.reason : undefined;

  if (!status && content === undefined && normalizedValue === undefined && category === undefined) {
    return NextResponse.json({ error: "no fields to patch" }, { status: 400 });
  }

  try {
    const result = await applyManualMemoryItemChange({
      userId,
      memoryItemId,
      actor: session.displayName || session.id,
      reason,
      status,
      content,
      normalizedValue,
      category,
    });

    return NextResponse.json({ userId, item: result.item, profile: result.profile ?? null });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao atualizar item." },
      { status: 500 },
    );
  }
}


import { NextRequest, NextResponse } from "next/server";

import { MEMORY_ITEM_STATUSES } from "@/lib/server/memory/constants";
import { MEMORY_ITEM_TYPES } from "@/lib/server/memory/constants";
import type { MemoryItemStatus, MemoryItemType } from "@/lib/server/memory/types";
import { listUserMemoryItemsByUserId } from "@/lib/server/memory/repository";
import { requireUser } from "@/lib/server/request";
import { isDatabaseBusyError } from "@/lib/server/db";

function parseLimit(value: string | null) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.max(1, Math.min(1000, Math.floor(parsed)));
}

function parseStatus(value: string | null): MemoryItemStatus | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  return (MEMORY_ITEM_STATUSES as readonly string[]).includes(raw) ? (raw as MemoryItemStatus) : undefined;
}

function parseType(value: string | null): MemoryItemType | undefined {
  const raw = String(value || "").trim();
  if (!raw) return undefined;
  return (MEMORY_ITEM_TYPES as readonly string[]).includes(raw) ? (raw as MemoryItemType) : undefined;
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

  const status = parseStatus(request.nextUrl.searchParams.get("status"));
  const type = parseType(request.nextUrl.searchParams.get("type"));
  const limit = parseLimit(request.nextUrl.searchParams.get("limit"));

  try {
    const items = await listUserMemoryItemsByUserId(userId, { status, type, limit });
    const response = NextResponse.json({ userId, items });
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
      { error: error instanceof Error ? error.message : "Falha ao listar itens." },
      { status: 500 },
    );
  }
}

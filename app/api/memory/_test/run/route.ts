import { NextRequest, NextResponse } from "next/server";

import { isDatabaseBusyError } from "@/lib/server/db";
import { buildContextPack } from "@/lib/server/memory/context-builder";
import { orchestrateMemoryCandidates } from "@/lib/server/memory/orchestrator";
import { getUserProfile } from "@/lib/server/memory/repository";
import { MEMORY_ITEM_TYPES } from "@/lib/server/memory/constants";
import type { MemoryItemType } from "@/lib/server/memory/types";
import { requireUser } from "@/lib/server/request";

type TestRunBody = {
  userId?: unknown;
  candidates?: unknown;
  agentType?: unknown;
  taskType?: unknown;
  limitItems?: unknown;
  includeTypes?: unknown;
};

function parseIncludeTypes(value: unknown): MemoryItemType[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const allowed = new Set(MEMORY_ITEM_TYPES as readonly string[]);
  const types = value.map((v) => String(v || "").trim()).filter((v) => allowed.has(v));
  return types.length ? (types as MemoryItemType[]) : undefined;
}

function parseLimitItems(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return undefined;
  return Math.max(1, Math.min(30, Math.floor(parsed)));
}

export async function POST(request: NextRequest) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as TestRunBody | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const candidates = Array.isArray(body?.candidates) ? body.candidates : null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!candidates) {
    return NextResponse.json({ error: "candidates must be an array" }, { status: 400 });
  }

  if (session.id !== "local-admin" && session.id !== userId) {
    return NextResponse.json({ error: "Proibido." }, { status: 403 });
  }

  const includeTypes = parseIncludeTypes(body?.includeTypes);
  const limitItems = parseLimitItems(body?.limitItems);

  try {
    const orchestrate = await orchestrateMemoryCandidates({
      userId,
      candidates,
      actor: session.displayName || session.id,
      reason: "internal_test_run",
      compileProfile: true,
    });

    const profile = orchestrate.profile ?? (await getUserProfile(userId));

    const contextPack = await buildContextPack({
      userId,
      agentType: typeof body?.agentType === "string" ? body.agentType : undefined,
      taskType: typeof body?.taskType === "string" ? body.taskType : undefined,
      limitItems,
      includeTypes,
    });

    return NextResponse.json({
      userId,
      orchestrate: {
        inserted: orchestrate.inserted,
        skippedDuplicates: orchestrate.skippedDuplicates,
        updatedExisting: orchestrate.updatedExisting,
        auditEntries: orchestrate.auditEntries,
        profileCompiled: orchestrate.profileCompiled,
      },
      profile,
      contextPack,
    });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao executar teste." },
      { status: 500 },
    );
  }
}

import { NextRequest, NextResponse } from "next/server";

import { orchestrateMemoryCandidates } from "@/lib/server/memory/orchestrator";
import { requireUser } from "@/lib/server/request";
import { isDatabaseBusyError } from "@/lib/server/db";

type OrchestrateBody = {
  userId?: unknown;
  candidates?: unknown;
};

export async function POST(request: NextRequest) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as OrchestrateBody | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  const candidates = Array.isArray(body?.candidates) ? body?.candidates : null;

  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }
  if (!candidates) {
    return NextResponse.json({ error: "candidates must be an array" }, { status: 400 });
  }

  if (session.id !== "local-admin" && session.id !== userId) {
    return NextResponse.json({ error: "Proibido." }, { status: 403 });
  }

  try {
    const result = await orchestrateMemoryCandidates({
      userId,
      candidates,
      actor: session.displayName || session.id,
      reason: "internal_api",
      compileProfile: true,
    });

    return NextResponse.json({
      userId,
      result: {
        inserted: result.inserted,
        skippedDuplicates: result.skippedDuplicates,
        updatedExisting: result.updatedExisting,
        auditEntries: result.auditEntries,
        profileCompiled: result.profileCompiled,
      },
    });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao orquestrar." },
      { status: 500 },
    );
  }
}


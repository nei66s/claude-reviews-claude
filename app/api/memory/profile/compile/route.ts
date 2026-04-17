import { NextRequest, NextResponse } from "next/server";

import { compileUserProfileFromActiveMemory } from "@/lib/server/memory/profile-compiler";
import { requireUser } from "@/lib/server/request";
import { isDatabaseBusyError } from "@/lib/server/db";

type CompileBody = {
  userId?: unknown;
};

export async function POST(request: NextRequest) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as CompileBody | null;
  const userId = typeof body?.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId required" }, { status: 400 });
  }

  if (session.id !== "local-admin" && session.id !== userId) {
    return NextResponse.json({ error: "Proibido." }, { status: 403 });
  }

  try {
    const profile = await compileUserProfileFromActiveMemory(userId);
    return NextResponse.json({ userId, profile });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao compilar perfil." },
      { status: 500 },
    );
  }
}


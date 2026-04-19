import { NextRequest, NextResponse } from "next/server";

import { getUserProfile } from "@/lib/server/memory/repository";
import { requireUser } from "@/lib/server/request";
import { isDatabaseBusyError } from "@/lib/server/db";

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

  try {
    const profile = await getUserProfile(userId);
    const response = NextResponse.json({ userId, profile });
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
      { error: error instanceof Error ? error.message : "Falha ao buscar perfil." },
      { status: 500 },
    );
  }
}

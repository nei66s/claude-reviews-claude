import { NextRequest, NextResponse } from "next/server";

import { isDatabaseBusyError } from "@/lib/server/db";
import { listUsersWithMemory } from "@/lib/server/memory/repository";
import { requireUser } from "@/lib/server/request";

export async function GET(request: NextRequest) {
  const session = requireUser(request);
  if (!session) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  // Apenas admins podem listar todos os usuários da memória
  if (session.id !== "local-admin") {
    return NextResponse.json({ users: [session.id] });
  }

  try {
    const users = await listUsersWithMemory();
    const response = NextResponse.json({ users });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado. Tente novamente." },
        { status: 503 },
      );
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao listar usuários." },
      { status: 500 },
    );
  }
}

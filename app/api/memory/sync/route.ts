import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { syncDatabaseMemoriesToVault } from "@/lib/server/chat-tools";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Nao autorizado." }, { status: 401 });
  }

  try {
    const result = await syncDatabaseMemoriesToVault(user);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha ao sincronizar memorias.",
      },
      { status: 500 },
    );
  }
}


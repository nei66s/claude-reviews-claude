import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { listFileEntries } from "@/lib/server/files";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const inputPath = request.nextUrl.searchParams.get("path") || ".";

  try {
    return NextResponse.json(await listFileEntries(inputPath));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao listar arquivos" },
      { status: 400 },
    );
  }
}


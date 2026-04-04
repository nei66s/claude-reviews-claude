import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import { appendLog } from "@/app/lib/server/store";
import { readFileForPreview } from "@/app/lib/server/files";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const inputPath = request.nextUrl.searchParams.get("path") || "";
  if (!inputPath.trim()) {
    return NextResponse.json({ error: "path required" }, { status: 400 });
  }

  try {
    const file = await readFileForPreview(inputPath);
    await appendLog(user, "info", "Preview de arquivo aberto", { path: file.path });
    return NextResponse.json(file);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Falha ao ler arquivo" },
      { status: 400 },
    );
  }
}


import fs from "node:fs/promises";

import { NextRequest } from "next/server";

import { requireUser } from "@/lib/server/request";
import { resolveFileScope } from "@/lib/server/files";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return new Response("NÃ£o autorizado.", { status: 401 });
  }

  const inputPath = request.nextUrl.searchParams.get("path") || "";
  if (!inputPath.trim()) {
    return new Response("path required", { status: 400 });
  }

  try {
    const scope = await resolveFileScope(inputPath);
    const stat = await fs.stat(scope.target);
    if (!stat.isFile()) {
      return new Response("Path is not a file", { status: 400 });
    }

    const buffer = await fs.readFile(scope.target);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao abrir arquivo", {
      status: 400,
    });
  }
}



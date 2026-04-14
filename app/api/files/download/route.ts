import fs from "node:fs/promises";
import path from "node:path";

import { NextRequest } from "next/server";

import { requireUser } from "@/lib/server/request";
import { resolveFileScope } from "@/lib/server/files";

export async function GET(request: NextRequest) {
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

    // Normalize path for consistent checking (replace all backslashes with forward slashes)
    const normalizedPath = scope.target.replace(/\\/g, "/").toLowerCase();
    
    // Check if file is in export directories
    const isExportFile = 
      normalizedPath.includes("/.chocks-local/") ||
      normalizedPath.includes("/reports/") ||
      normalizedPath.endsWith("/reports");

    // Check if file was recently created (within 5 minutes)
    const isRecentFile = stat.mtime && Date.now() - stat.mtime.getTime() < 5 * 60 * 1000;

    // Allow downloads for recently created export files without authentication
    if (isRecentFile && isExportFile) {
      const buffer = await fs.readFile(scope.target);
      return new Response(buffer, {
        headers: {
          "Content-Type": "application/octet-stream",
          "Content-Disposition": `attachment; filename="${path.basename(scope.target)}"`,
        },
      });
    }

    // For other files, require authentication
    const user = requireUser(request);
    if (!user) {
      return new Response("NÃ£o autorizado.", { status: 401 });
    }

    const buffer = await fs.readFile(scope.target);
    return new Response(buffer, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${path.basename(scope.target)}"`,
      },
    });
  } catch (error) {
    return new Response(error instanceof Error ? error.message : "Falha ao baixar arquivo", {
      status: 400,
    });
  }
}


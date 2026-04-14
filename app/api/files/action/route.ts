import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { appendLog } from "@/lib/server/store";
import {
  copyFileSystemEntry,
  createDirectory,
  createEmptyFile,
  deleteFileSystemEntry,
  moveFileSystemEntry,
  writeFileContents,
} from "@/lib/server/files";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const action = typeof body?.action === "string" ? body.action.trim() : "";

  try {
    if (action === "write") {
      const targetPath = typeof body?.path === "string" ? body.path : "";
      const content = typeof body?.content === "string" ? body.content : "";
      const result = await writeFileContents(targetPath, content);
      await appendLog(user, "info", "Arquivo salvo", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "file_write",
          state: "complete",
          subtitle: "Arquivo salvo no filesystem.",
          payload: result,
        },
      });
    }

    if (action === "create_file") {
      const targetPath = typeof body?.path === "string" ? body.path : "";
      const result = await createEmptyFile(targetPath);
      await appendLog(user, "info", "Arquivo criado", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "file_write",
          state: "complete",
          subtitle: "Arquivo vazio criado.",
          payload: result,
        },
      });
    }

    if (action === "create_dir") {
      const targetPath = typeof body?.path === "string" ? body.path : "";
      const result = await createDirectory(targetPath);
      await appendLog(user, "info", "Pasta criada", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "directory_create",
          state: "complete",
          subtitle: "Pasta criada.",
          payload: result,
        },
      });
    }

    if (action === "move") {
      const fromPath = typeof body?.fromPath === "string" ? body.fromPath : "";
      const toPath = typeof body?.toPath === "string" ? body.toPath : "";
      const result = await moveFileSystemEntry(fromPath, toPath);
      await appendLog(user, "info", "Item movido", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "file_move",
          state: "complete",
          subtitle: "Item movido ou renomeado.",
          payload: result,
        },
      });
    }

    if (action === "copy") {
      const fromPath = typeof body?.fromPath === "string" ? body.fromPath : "";
      const toPath = typeof body?.toPath === "string" ? body.toPath : "";
      const result = await copyFileSystemEntry(fromPath, toPath);
      await appendLog(user, "info", "Item copiado", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "file_copy",
          state: "complete",
          subtitle: "Item copiado.",
          payload: result,
        },
      });
    }

    if (action === "delete") {
      const targetPath = typeof body?.path === "string" ? body.path : "";
      const result = await deleteFileSystemEntry(targetPath);
      await appendLog(user, "warn", "Item removido", result);
      return NextResponse.json({
        ok: true,
        result,
        trace: {
          type: "tool_call",
          label: "file_delete",
          state: "complete",
          subtitle: "Item removido do filesystem.",
          payload: result,
        },
      });
    }

    return NextResponse.json({ error: "unsupported action" }, { status: 400 });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Falha na operacao de arquivo",
        trace: {
          type: "tool_call",
          label: action || "filesystem",
          state: "error",
          subtitle: "A operacao falhou.",
          payload: {
            action,
            message: error instanceof Error ? error.message : "Falha na operacao de arquivo",
          },
        },
      },
      { status: 400 },
    );
  }
}


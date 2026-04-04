import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import {
  setFullAccess,
  setPermissionMode,
  setSandboxSettings,
  setToolApproval,
  toggleTool,
} from "@/app/lib/server/store";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const enabled = Boolean(body?.enabled);

  if (!name) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }

  if (name === "full_access") {
    return NextResponse.json({
      settings: await setFullAccess(user, enabled),
    });
  }

  if (name === "permission_mode") {
    const permissionMode =
      body?.permissionMode === "auto" || body?.permissionMode === "read_only"
        ? body.permissionMode
        : "ask";
    return NextResponse.json({
      settings: await setPermissionMode(user, permissionMode),
    });
  }

  if (name === "tool_approval") {
    const toolName = typeof body?.toolName === "string" ? body.toolName.trim() : "";
    if (!toolName) {
      return NextResponse.json({ error: "toolName required" }, { status: 400 });
    }
    return NextResponse.json({
      settings: await setToolApproval(user, toolName, enabled),
    });
  }

  if (name === "sandbox_settings") {
    const writableRoots = Array.isArray(body?.writableRoots)
      ? body.writableRoots.map((item: unknown) => String(item || "").trim()).filter(Boolean)
      : [];
    return NextResponse.json({
      settings: await setSandboxSettings(user, {
        enabled,
        writableRoots,
      }),
    });
  }

  return NextResponse.json({
    tool: await toggleTool(user, name, enabled),
  });
}

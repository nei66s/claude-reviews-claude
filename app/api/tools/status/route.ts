import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import { listTools, readAppSettings } from "@/app/lib/server/store";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const settings = await readAppSettings();

  return NextResponse.json({
    fullAccess: settings.fullAccess,
    permissionMode: settings.permissionMode,
    approvedTools: settings.approvedTools,
    sandboxEnabled: settings.sandboxEnabled,
    sandboxWritableRoots: settings.sandboxWritableRoots,
    tools: await listTools(user),
  });
}

import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { togglePlugin } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const enabled = Boolean(body?.enabled);

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  return NextResponse.json({
    plugin: await togglePlugin(user, id, enabled),
  });
}


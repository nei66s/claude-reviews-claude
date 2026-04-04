import { NextRequest, NextResponse } from "next/server";

import { renameConversation } from "@/app/lib/server/store";
import { requireUser } from "@/app/lib/server/request";

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json().catch(() => null);
  const title = typeof body?.title === "string" ? body.title : "";

  if (!id?.trim()) {
    return NextResponse.json({ error: "conversation id required" }, { status: 400 });
  }

  if (!title.trim()) {
    return NextResponse.json({ error: "title required" }, { status: 400 });
  }

  return NextResponse.json({
    conversation: await renameConversation(user, id.trim(), title),
  });
}


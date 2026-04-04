import crypto from "node:crypto";

import { NextRequest, NextResponse } from "next/server";

import { duplicateConversation } from "@/app/lib/server/store";
import { requireUser } from "@/app/lib/server/request";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const { id } = await params;
  const nextId = crypto.randomUUID();

  if (!id?.trim()) {
    return NextResponse.json({ error: "conversation id required" }, { status: 400 });
  }

  return NextResponse.json({
    conversation: await duplicateConversation(user, id.trim(), nextId),
  });
}

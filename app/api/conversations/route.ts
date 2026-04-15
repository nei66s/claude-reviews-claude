import { NextRequest, NextResponse } from "next/server";

import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/server/store";
import { requireUser } from "@/lib/server/request";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const response = NextResponse.json({ conversations: await listConversations(user) });
  
  // Banco é ultra-veloz no datacenter local, busca sempre fresco
  response.headers.set(
    "Cache-Control",
    "no-store, must-revalidate"
  );
  
  return response;
}

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const id = typeof body?.id === "string" ? body.id.trim() : "";
  const title = typeof body?.title === "string" ? body.title : "Nova conversa";

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  return NextResponse.json({
    conversation: await createConversation(user, { id, title }),
  });
}

export async function DELETE(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id")?.trim() || "";

  if (!id) {
    return NextResponse.json({ error: "id required" }, { status: 400 });
  }

  await deleteConversation(user, id);
  const response = NextResponse.json({ ok: true });
  response.headers.set(
    "Cache-Control",
    "no-store, must-revalidate"
  );
  return response;
}


import { NextRequest, NextResponse } from "next/server";

import {
  createConversation,
  deleteConversation,
  listConversations,
} from "@/lib/server/store";
import { requireUser } from "@/lib/server/request";
import { isDatabaseBusyError } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  try {
    const response = NextResponse.json({ conversations: await listConversations(user) });
    response.headers.set("Cache-Control", "no-store");
    return response;
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    throw error;
  }
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

  try {
    return NextResponse.json({
      conversation: await createConversation(user, { id, title }),
    });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    throw error;
  }
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

  try {
    await deleteConversation(user, id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isDatabaseBusyError(error)) {
      return NextResponse.json(
        { error: "Banco de dados ocupado (muitos clientes). Tente novamente em alguns segundos." },
        { status: 503 },
      );
    }
    throw error;
  }
}


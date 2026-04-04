import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import { getWorkflowState } from "@/app/lib/server/store";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado." }, { status: 401 });
  }

  const chatId = request.nextUrl.searchParams.get("chatId")?.trim() || "";
  if (!chatId) {
    return NextResponse.json({ active: null });
  }

  return NextResponse.json({
    active: await getWorkflowState(user, chatId),
  });
}


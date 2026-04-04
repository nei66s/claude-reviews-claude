import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  return NextResponse.json({ user });
}

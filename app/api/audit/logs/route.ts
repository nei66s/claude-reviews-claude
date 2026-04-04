import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/app/lib/server/request";
import { listLogs } from "@/app/lib/server/store";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json({ logs: await listLogs(user) });
}

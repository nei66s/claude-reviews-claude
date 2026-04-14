import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { listPlugins } from "@/lib/server/store";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  return NextResponse.json({ plugins: await listPlugins(user) });
}


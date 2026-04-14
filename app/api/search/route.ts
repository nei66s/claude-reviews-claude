import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { searchWeb } from "@/lib/server/search-tools";

export async function POST(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);

  try {
    const result = await searchWeb(user, {
      query: typeof body?.query === "string" ? body.query : "",
      max_results: typeof body?.maxResults === "number" ? body.maxResults : undefined,
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Falha na web search.",
      },
      { status: 400 },
    );
  }
}


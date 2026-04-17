import { NextRequest, NextResponse } from "next/server";

import { requireUser } from "@/lib/server/request";
import { findDbUserByEmail, hasDatabase } from "@/lib/server/db";

export async function GET(request: NextRequest) {
  const user = requireUser(request);
  if (!user) {
    return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });
  }

  let avatar = null;
  if (hasDatabase()) {
    try {
      const dbUser = await findDbUserByEmail(user.email).catch(() => null);
      avatar = dbUser?.avatar ?? null;
    } catch {
      // Continue without avatar if DB fails
    }
  }

  return NextResponse.json({
    user: {
      ...user,
      avatar,
    },
  });
}


import { NextRequest, NextResponse } from "next/server";

import { authenticate, createToken, isAuthConfigured } from "@/lib/server/auth";
import { appendLog } from "@/lib/server/store";

export async function POST(request: NextRequest) {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Autenticacao indisponivel. Configure AUTH_SECRET." },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === "string" ? body.email : "";
  const password = typeof body?.password === "string" ? body.password : "";

  const user = await authenticate(email, password);
  if (!user) {
    return NextResponse.json(
      { error: "Email ou senha invalidos." },
      { status: 401 },
    );
  }

  await appendLog(user, "info", "Login realizado", { email: user.email });

  return NextResponse.json({
    token: createToken(user),
    user,
  });
}


import { NextResponse } from "next/server";
import { getLoginConfig } from "@/lib/server/auth";

export async function GET() {
  const config = getLoginConfig();
  
  if (!config) {
    return NextResponse.json(
      { error: "Auth is not configured" },
      { status: 503 }
    );
  }

  return NextResponse.json({
    email: config.email,
    displayName: config.displayName,
    passwordConfigured: !!(process.env.ADMIN_PASSWORD || "").trim(),
    envVars: {
      ADMIN_EMAIL: process.env.ADMIN_EMAIL || "NOT SET",
      ADMIN_PASSWORD_LENGTH: (process.env.ADMIN_PASSWORD || "").length,
      AUTH_SECRET_LENGTH: (process.env.AUTH_SECRET || "").length,
    }
  });
}

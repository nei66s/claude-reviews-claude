import { NextResponse } from "next/server";
import { isAuthConfigured } from "@/lib/server/auth";
import { findDbUserByEmail } from "@/lib/server/db";

export async function GET() {
  if (!isAuthConfigured()) {
    return NextResponse.json(
      { error: "Auth is not configured. Set AUTH_SECRET." },
      { status: 503 }
    );
  }

  let adminUser = null;
  try {
    adminUser = await findDbUserByEmail("admin@gmail.com");
  } catch {
    // Database might not be available
  }

  return NextResponse.json({
    authConfigured: isAuthConfigured(),
    adminUserExists: !!adminUser,
    adminUser: adminUser ? {
      id: adminUser.id,
      email: adminUser.email,
      displayName: adminUser.display_name,
      passwordSet: !!adminUser.password_hash,
    } : null,
    envVars: {
      AUTH_SECRET_LENGTH: (process.env.AUTH_SECRET || "").length,
    }
  });
}

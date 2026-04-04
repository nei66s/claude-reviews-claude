import { NextRequest } from "next/server";

import { verifyToken } from "./auth";

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

export function requireUser(request: NextRequest) {
  const token = getBearerToken(request);
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

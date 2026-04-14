import { NextRequest } from "next/server";

import { verifyToken } from "./auth";

export function getBearerToken(request: NextRequest) {
  const header = request.headers.get("authorization") || "";
  if (!header.toLowerCase().startsWith("bearer ")) {
    return null;
  }

  return header.slice(7).trim() || null;
}

export function getQueryToken(request: NextRequest) {
  return request.nextUrl.searchParams.get("token") || null;
}

export function requireUser(request: NextRequest) {
  let token = getBearerToken(request);
  if (!token) {
    token = getQueryToken(request);
  }
  if (!token) {
    return null;
  }

  return verifyToken(token);
}

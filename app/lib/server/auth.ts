import crypto from "node:crypto";
import { findDbUserByEmail } from "./db";

export type SessionUser = {
  id: string;
  email: string;
  displayName: string;
};

type TokenPayload = SessionUser & {
  exp: number;
};

const TOKEN_TTL_SECONDS = 60 * 60 * 12;

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url<T>(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as T;
}

function getAuthSecret(): string | null {
  const secret = process.env.AUTH_SECRET?.trim();
  return secret || null;
}

function hashPassword(password: string): string {
  return crypto.createHash("sha256").update(password).digest("hex");
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function isAuthConfigured() {
  return getAuthSecret() !== null;
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();

  const dbUser = await findDbUserByEmail(normalizedEmail).catch(() => null);
  if (!dbUser) {
    return null;
  }

  if (!dbUser.password_hash) {
    return null;
  }

  const passwordHash = hashPassword(normalizedPassword);
  if (passwordHash !== dbUser.password_hash) {
    return null;
  }

  return {
    id: dbUser.id,
    email: dbUser.email ?? "",
    displayName: dbUser.display_name,
  } satisfies SessionUser;
}

export function createToken(user: SessionUser) {
  const secret = getAuthSecret();
  if (!secret) {
    throw new Error("AUTH_SECRET is not configured.");
  }

  const payload: TokenPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string) {
  const secret = getAuthSecret();
  if (!secret) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, secret);
  if (providedSignature !== expectedSignature) {
    return null;
  }

  try {
    const payload = decodeBase64Url<TokenPayload>(encodedPayload);
    if (payload.exp <= Math.floor(Date.now() / 1000)) {
      return null;
    }

    return {
      id: payload.id,
      email: payload.email,
      displayName: payload.displayName,
    } satisfies SessionUser;
  } catch {
    return null;
  }
}

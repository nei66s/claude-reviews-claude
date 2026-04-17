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

type AuthConfig = {
  email: string;
  password: string;
  displayName: string;
  secret: string;
};

type LoginAccount = {
  email: string;
  password: string;
  displayName: string;
};

function encodeBase64Url(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function decodeBase64Url<T>(input: string) {
  return JSON.parse(Buffer.from(input, "base64url").toString("utf8")) as T;
}

function getAuthConfig(): AuthConfig | null {
  const email = process.env.ADMIN_EMAIL?.trim();
  const password = process.env.ADMIN_PASSWORD?.trim();
  const displayName = process.env.ADMIN_DISPLAY_NAME?.trim() || "Admin Chocks";
  const secret = process.env.AUTH_SECRET?.trim();

  if (!email || !password || !secret) {
    return null;
  }

  return {
    email,
    password,
    displayName,
    secret,
  };
}

function getSecondaryLoginAccount(): LoginAccount | null {
  const email = process.env.SECONDARY_EMAIL?.trim();
  const password = process.env.SECONDARY_PASSWORD?.trim();
  const displayName = process.env.SECONDARY_DISPLAY_NAME?.trim() || "Secondary User";

  if (!email || !password) {
    return null;
  }

  return {
    email,
    password,
    displayName,
  };
}

function sign(value: string, secret: string) {
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export function isAuthConfigured() {
  return getAuthConfig() !== null;
}

export function getLoginConfig() {
  const config = getAuthConfig();
  if (!config) {
    return null;
  }

  return {
    email: config.email,
    password: config.password,
    displayName: config.displayName,
  };
}

export async function authenticate(email: string, password: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const normalizedPassword = password.trim();
  const config = getLoginConfig();
  if (!config) {
    throw new Error("Auth is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD and AUTH_SECRET.");
  }

  const accounts: LoginAccount[] = [config];
  const secondaryAccount = getSecondaryLoginAccount();
  if (secondaryAccount) {
    accounts.push(secondaryAccount);
  }

  const matchedAccount = accounts.find(
    (account) =>
      normalizedEmail === account.email.toLowerCase() &&
      normalizedPassword === account.password,
  );

  if (!matchedAccount) {
    return null;
  }

  const dbUser = await findDbUserByEmail(matchedAccount.email).catch(() => null);
  const isAdminAccount = matchedAccount.email.toLowerCase() === config.email.toLowerCase();

  return {
    id: dbUser?.id ?? (isAdminAccount ? "local-admin" : matchedAccount.email),
    email: dbUser?.email ?? matchedAccount.email,
    displayName: dbUser?.display_name ?? matchedAccount.displayName,
  } satisfies SessionUser;
}

export function createToken(user: SessionUser) {
  const config = getAuthConfig();
  if (!config) {
    throw new Error("Auth is not configured. Set AUTH_SECRET before issuing tokens.");
  }

  const payload: TokenPayload = {
    ...user,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const encodedPayload = encodeBase64Url(JSON.stringify(payload));
  const signature = sign(encodedPayload, config.secret);
  return `${encodedPayload}.${signature}`;
}

export function verifyToken(token: string) {
  const config = getAuthConfig();
  if (!config) {
    return null;
  }

  const [encodedPayload, providedSignature] = token.split(".");
  if (!encodedPayload || !providedSignature) {
    return null;
  }

  const expectedSignature = sign(encodedPayload, config.secret);
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

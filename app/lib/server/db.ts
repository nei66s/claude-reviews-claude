import { Pool, type QueryResult, type QueryResultRow } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
const ssl =
  process.env.PGSSLMODE?.trim() === "require"
    ? { rejectUnauthorized: false }
    : undefined;

function parsePositiveInt(value: string | undefined) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return null;
  return Math.floor(parsed);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPgErrorWithCode(error: unknown): error is { code?: string } {
  return typeof error === "object" && error !== null && "code" in error;
}

export function isDatabaseBusyError(error: unknown) {
  if (!isPgErrorWithCode(error)) return false;
  // 53300: too many connections; 57P03: cannot_connect_now (e.g. starting up)
  return error.code === "53300" || error.code === "57P03";
}

declare global {
  var __chocksPgPool: Pool | undefined;
  var __chocksPgPoolShutdownHandlersRegistered: boolean | undefined;
}

export function hasDatabase() {
  return !!connectionString;
}

export function getDb() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!global.__chocksPgPoolShutdownHandlersRegistered) {
    global.__chocksPgPoolShutdownHandlersRegistered = true;

    const shutdown = async () => {
      const pool = global.__chocksPgPool;
      global.__chocksPgPool = undefined;
      if (pool) {
        await pool.end().catch(() => null);
      }
    };

    process.on("beforeExit", () => {
      void shutdown();
    });

    process.on("SIGINT", () => {
      void shutdown().finally(() => process.exit(0));
    });

    process.on("SIGTERM", () => {
      void shutdown().finally(() => process.exit(0));
    });
  }

  if (!global.__chocksPgPool) {
    const isProd = process.env.NODE_ENV === "production";
    const max = parsePositiveInt(process.env.PG_POOL_MAX) ?? (isProd ? 10 : 1);
    const idleTimeoutMillis =
      parsePositiveInt(process.env.PG_POOL_IDLE_TIMEOUT_MS) ?? (isProd ? 30_000 : 1_000);
    const connectionTimeoutMillis =
      parsePositiveInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS) ?? 5_000;

    global.__chocksPgPool = new Pool({
      connectionString,
      ssl,
      max,
      idleTimeoutMillis,
      connectionTimeoutMillis,
    });
    global.__chocksPgPool.on("error", (err) => {
      console.error("[db] Pool error:", err);
    });
  }

  return global.__chocksPgPool;
}

export async function dbQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = [],
) {
  const isProd = process.env.NODE_ENV === "production";
  const retries = parsePositiveInt(process.env.PG_QUERY_RETRIES) ?? (isProd ? 0 : 8);
  const baseDelayMs = parsePositiveInt(process.env.PG_QUERY_RETRY_BASE_DELAY_MS) ?? 100;
  const maxDelayMs = parsePositiveInt(process.env.PG_QUERY_RETRY_MAX_DELAY_MS) ?? 2_000;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const db = getDb();
      return (await db.query<T>(text, params)) as QueryResult<T>;
    } catch (error) {
      const shouldRetry = attempt < retries && isDatabaseBusyError(error);
      if (!shouldRetry) throw error;

      const expBackoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const jitter = Math.floor(Math.random() * 50);
      const delayMs = expBackoff + jitter;

      console.warn(
        `[db] Postgres busy (${isPgErrorWithCode(error) ? error.code : "unknown"}). Retrying query in ${delayMs}ms (${attempt + 1}/${retries + 1})...`,
      );
      await sleep(delayMs);
    }
  }

  // Unreachable, but keeps TS happy.
  throw new Error("dbQuery: exhausted retries");
}

export type DbUser = {
  id: string;
  email: string | null;
  display_name: string;
  avatar?: string | null;
};

export async function findDbUserByEmail(email: string) {
  const result = await dbQuery<DbUser>(
    `select id, email, display_name, avatar
     from public.app_users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function updateDbUser(userId: string, displayName: string, avatar?: string | null) {
  const result = await dbQuery<DbUser>(
    `update public.app_users
     set display_name = $1,
          avatar = coalesce($3, avatar),
          updated_at = now()
     where id = $2
     returning id, email, display_name, avatar`,
    [displayName, userId, avatar !== undefined ? avatar : null],
  );

  return result.rows[0] ?? null;
}

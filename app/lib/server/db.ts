import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL?.trim();
const ssl =
  process.env.PGSSLMODE?.trim() === "require"
    ? { rejectUnauthorized: false }
    : undefined;

let pool: Pool | null = null;

export function hasDatabase() {
  return !!connectionString;
}

export function getDb() {
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  if (!pool) {
    pool = new Pool({
      connectionString,
      ssl,
    });
  }

  return pool;
}

export type DbUser = {
  id: string;
  email: string | null;
  display_name: string;
  avatar?: string | null;
};

export async function findDbUserByEmail(email: string) {
  const db = getDb();
  const result = await db.query<DbUser>(
    `select id, email, display_name
     from public.app_users
     where lower(email) = lower($1)
     limit 1`,
    [email],
  );

  return result.rows[0] ?? null;
}

export async function updateDbUser(userId: string, displayName: string, avatar?: string | null) {
  const db = getDb();
  const result = await db.query<DbUser>(
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

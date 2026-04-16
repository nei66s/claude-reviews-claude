async function loadDeps() {
  const nextEnv = await import("@next/env");
  const pg = await import("pg");

  const loadEnvConfig = nextEnv.loadEnvConfig ?? nextEnv.default?.loadEnvConfig;
  const Pool = pg.Pool ?? pg.default?.Pool;

  if (!loadEnvConfig) {
    throw new Error("Failed to load @next/env loadEnvConfig.");
  }
  if (!Pool) {
    throw new Error("Failed to load pg Pool.");
  }

  return { loadEnvConfig, Pool };
}

function maskDbUrl(url) {
  try {
    const u = new URL(url);
    if (u.password) u.password = "*****";
    return u.toString();
  } catch {
    return "<invalid DATABASE_URL>";
  }
}

async function main() {
  const { loadEnvConfig, Pool } = await loadDeps();
  loadEnvConfig(process.cwd());

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("❌ DATABASE_URL não está configurada (verifique .env.local).");
    process.exitCode = 1;
    return;
  }

  const ssl =
    process.env.PGSSLMODE?.trim() === "require"
      ? { rejectUnauthorized: false }
      : undefined;

  const pool = new Pool({ connectionString, ssl });

  try {
    console.log("🔎 Testando conexão com o Postgres…");
    console.log(`- DATABASE_URL: ${maskDbUrl(connectionString)}`);
    if (ssl) console.log("- SSL: habilitado (PGSSLMODE=require)");

    const ping = await pool.query("select 1 as ok");
    const ok = ping.rows?.[0]?.ok === 1;

    const tables = await pool.query(
      `select to_regclass('public.app_users') as app_users`,
    );
    const appUsersExists = !!tables.rows?.[0]?.app_users;

    console.log(`✅ Conectou e executou query (select 1): ${ok ? "OK" : "OK (valor inesperado)"}`);
    console.log(`- Tabela public.app_users: ${appUsersExists ? "encontrada" : "não encontrada"}`);
  } catch (err) {
    console.error("❌ Falhou ao conectar/consultar o banco.");
    console.error(err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("❌ Erro inesperado ao testar o banco.");
  console.error(err?.message ?? err);
  process.exitCode = 1;
});

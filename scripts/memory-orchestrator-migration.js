async function loadNodeModules() {
  const fs = await import("node:fs");
  const path = await import("node:path");
  return { fs, path };
}

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

function readMigrationSql({ fs, path }) {
  const migrationPath = path.join(
    process.cwd(),
    "app",
    "lib",
    "server",
    "migrations",
    "memory-orchestrator.migration.ts",
  );
  const source = fs.readFileSync(migrationPath, "utf8");
  const match = source.match(/MEMORY_ORCHESTRATOR_MIGRATION\s*=\s*`([\s\S]*?)`;/);
  if (!match?.[1]) {
    throw new Error(`Failed to extract SQL from ${migrationPath}`);
  }
  return { migrationPath, sql: match[1] };
}

async function checkSchema(pool) {
  const regs = await pool.query(
    "select to_regclass('public.user_memory_items') as user_memory_items, to_regclass('public.user_profile') as user_profile, to_regclass('public.memory_audit_log') as memory_audit_log, to_regclass('public.memory_ingestion_governance') as memory_ingestion_governance",
  );
  const row = regs.rows?.[0] ?? {};
  const missing = [];
  if (!row.user_memory_items) missing.push("public.user_memory_items");
  if (!row.user_profile) missing.push("public.user_profile");
  if (!row.memory_audit_log) missing.push("public.memory_audit_log");
  if (!row.memory_ingestion_governance) missing.push("public.memory_ingestion_governance");
  return { ok: missing.length === 0, missing };
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const checkOnly = args.has("--check");

  const nodeModules = await loadNodeModules();
  const { loadEnvConfig, Pool } = await loadDeps();
  loadEnvConfig(process.cwd());

  const connectionString = process.env.DATABASE_URL?.trim();
  if (!connectionString) {
    console.error("❌ DATABASE_URL não está configurada (verifique .env.local).");
    process.exitCode = 1;
    return;
  }

  const ssl = process.env.PGSSLMODE?.trim() === "require" ? { rejectUnauthorized: false } : undefined;
  const pool = new Pool({ connectionString, ssl });

  try {
    console.log("🔎 Memory Orchestrator migration");
    console.log(`- DATABASE_URL: ${maskDbUrl(connectionString)}`);
    if (ssl) console.log("- SSL: habilitado (PGSSLMODE=require)");

    const before = await checkSchema(pool);
    if (before.ok) {
      console.log("✅ Schema já está aplicado (tabelas encontradas).");
      return;
    }

    console.log(`- Tabelas faltando: ${before.missing.join(", ")}`);
    if (checkOnly) {
      console.log("ℹ️ Modo --check: não aplicou migration.");
      process.exitCode = 2;
      return;
    }

    const { migrationPath, sql } = readMigrationSql(nodeModules);
    console.log(`⚙️ Aplicando migration: ${migrationPath}`);
    await pool.query(sql);

    const after = await checkSchema(pool);
    if (!after.ok) {
      throw new Error(`Schema ainda incompleto após migration (missing: ${after.missing.join(", ")}).`);
    }

    console.log("✅ Migration aplicada com sucesso.");
  } catch (err) {
    console.error("❌ Falha ao checar/aplicar migration.");
    console.error(err?.message ?? err);
    process.exitCode = 1;
  } finally {
    await pool.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error("❌ Erro inesperado ao rodar migration.");
  console.error(err?.message ?? err);
  process.exitCode = 1;
});

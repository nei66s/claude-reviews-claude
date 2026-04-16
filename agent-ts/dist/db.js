import dotenv from 'dotenv';
import pg from 'pg';
// Load .env.local first (before any other config)
dotenv.config({ path: '.env.local' });
dotenv.config(); // Then load .env as fallback
const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
    throw new Error('DATABASE_URL not set in environment');
}
function parsePositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed <= 0)
        return null;
    return Math.floor(parsed);
}
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
function isPgErrorWithCode(error) {
    return typeof error === 'object' && error !== null && 'code' in error;
}
function isRetryableStartupError(error) {
    if (!isPgErrorWithCode(error))
        return false;
    // 53300: too many connections; 57P03: cannot_connect_now (e.g. starting up)
    return error.code === '53300' || error.code === '57P03';
}
function getPoolConfig() {
    const isProd = process.env.NODE_ENV === 'production';
    const max = parsePositiveInt(process.env.PG_POOL_MAX) ?? (isProd ? 10 : 1);
    const idleTimeoutMillis = parsePositiveInt(process.env.PG_POOL_IDLE_TIMEOUT_MS) ?? (isProd ? 30_000 : 1_000);
    const connectionTimeoutMillis = parsePositiveInt(process.env.PG_POOL_CONNECTION_TIMEOUT_MS) ?? 5_000;
    return {
        connectionString: DATABASE_URL,
        ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
        max,
        idleTimeoutMillis,
        connectionTimeoutMillis,
    };
}
function getPool() {
    if (!global.__chocksPgPool) {
        global.__chocksPgPool = new Pool(getPoolConfig());
        global.__chocksPgPool.on('error', (err) => {
            console.error('[db] Pool error:', err);
        });
    }
    return global.__chocksPgPool;
}
export async function closePool() {
    const pool = global.__chocksPgPool;
    global.__chocksPgPool = undefined;
    if (pool) {
        await pool.end().catch(() => null);
    }
}
export async function query(text, params = []) {
    return getPool().query(text, params);
}
export async function withTransaction(fn) {
    const client = await getPool().connect();
    try {
        await client.query('BEGIN');
        const result = await fn(client);
        await client.query('COMMIT');
        return result;
    }
    catch (error) {
        await client.query('ROLLBACK');
        throw error;
    }
    finally {
        client.release();
    }
}
export async function initDatabase() {
    const isProd = process.env.NODE_ENV === 'production';
    const retries = parsePositiveInt(process.env.PG_INIT_RETRIES) ?? (isProd ? 0 : 12);
    const baseDelayMs = parsePositiveInt(process.env.PG_INIT_RETRY_BASE_DELAY_MS) ?? 250;
    const maxDelayMs = parsePositiveInt(process.env.PG_INIT_RETRY_MAX_DELAY_MS) ?? 5_000;
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            await getPool().query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id TEXT PRIMARY KEY,
      display_name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
      content TEXT NOT NULL DEFAULT '',
      trace_json JSONB,
      streaming BOOLEAN NOT NULL DEFAULT FALSE,
      agent_id TEXT,
      helper_agent_id TEXT,
      handoff_label TEXT,
      collaboration_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, sort_order)
    );

    ALTER TABLE IF EXISTS messages
      ADD COLUMN IF NOT EXISTS agent_id TEXT;
    ALTER TABLE IF EXISTS messages
      ADD COLUMN IF NOT EXISTS helper_agent_id TEXT;
    ALTER TABLE IF EXISTS messages
      ADD COLUMN IF NOT EXISTS handoff_label TEXT;
    ALTER TABLE IF EXISTS messages
      ADD COLUMN IF NOT EXISTS collaboration_label TEXT;

    CREATE TABLE IF NOT EXISTS message_attachments (
      id BIGSERIAL PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      sort_order INTEGER NOT NULL,
      name TEXT NOT NULL,
      UNIQUE (message_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS workflow_plans (
      conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
      goal TEXT NOT NULL,
      summary TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS workflow_steps (
      id BIGSERIAL PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES workflow_plans(conversation_id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      text TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed')),
      sort_order INTEGER NOT NULL,
      UNIQUE (conversation_id, step_id),
      UNIQUE (conversation_id, sort_order)
    );

    CREATE TABLE IF NOT EXISTS agent_todos (
      id BIGSERIAL PRIMARY KEY,
      owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      done BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS token_usage (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      tokens_used INT NOT NULL DEFAULT 0,
      used_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS token_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      tokens_used_today INT NOT NULL DEFAULT 0,
      tokens_used_this_month INT NOT NULL DEFAULT 0,
      tokens_used_this_hour INT NOT NULL DEFAULT 0,
      last_reset_hour INT NOT NULL,
      last_reset_day DATE NOT NULL DEFAULT CURRENT_DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, chat_id),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cost_logs (
      id BIGSERIAL PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      model TEXT NOT NULL,
      input_tokens INT NOT NULL,
      output_tokens INT NOT NULL,
      total_cost DECIMAL(10, 6) NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS cost_budgets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_id TEXT NOT NULL,
      monthly_budget_cents INT NOT NULL DEFAULT 10000,
      spent_this_month DECIMAL(10, 6) NOT NULL DEFAULT 0,
      last_reset_month DATE NOT NULL DEFAULT DATE_TRUNC('month', CURRENT_DATE)::DATE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (user_id, chat_id),
      FOREIGN KEY (user_id) REFERENCES app_users(id) ON DELETE CASCADE
    );
  `);
            await getPool().query(`
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;
    ALTER TABLE agent_todos ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;
  `);
            await getPool().query(`
    INSERT INTO app_users (id, display_name, created_at, updated_at)
    VALUES ('legacy-local', 'Local legacy', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
            await getPool().query(`
    UPDATE conversations
    SET owner_id = 'legacy-local'
    WHERE owner_id IS NULL;

    UPDATE agent_todos
    SET owner_id = 'legacy-local'
    WHERE owner_id IS NULL;
  `);
            await getPool().query(`
    ALTER TABLE conversations ALTER COLUMN owner_id SET NOT NULL;
    ALTER TABLE agent_todos ALTER COLUMN owner_id SET NOT NULL;
  `);
            await getPool().query(`
    CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON messages (conversation_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_attachments_message_id ON message_attachments (message_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_workflow_steps_conversation_id ON workflow_steps (conversation_id, sort_order);
    CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON conversations (owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_agent_todos_owner_id ON agent_todos (owner_id, id ASC);

    CREATE INDEX IF NOT EXISTS idx_token_usage_user_chat ON token_usage (user_id, chat_id, used_at DESC);
    CREATE INDEX IF NOT EXISTS idx_token_usage_hour ON token_usage (used_at DESC);
    CREATE INDEX IF NOT EXISTS idx_token_budgets_user ON token_budgets (user_id, updated_at DESC);

    CREATE INDEX IF NOT EXISTS idx_cost_logs_user_chat ON cost_logs (user_id, chat_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cost_logs_model ON cost_logs (model, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_cost_logs_hour ON cost_logs (created_at DESC);
  `);
            // Coordination system tables (multi-agent coordination)
            await getPool().query(`
    CREATE TABLE IF NOT EXISTS coordination_teams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      leader_agent_id TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      config JSONB,
      UNIQUE(leader_agent_id)
    );

    CREATE TABLE IF NOT EXISTS coordination_agents (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL,
      role TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('idle', 'working', 'blocked', 'completed')) DEFAULT 'idle',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_activity TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, agent_id)
    );

    CREATE TABLE IF NOT EXISTS coordination_messages (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      from_agent_id TEXT NOT NULL,
      to_agent_id TEXT,
      message_type TEXT NOT NULL CHECK (message_type IN (
        'direct_message', 'broadcast', 'idle_notification', 'permission_request',
        'permission_response', 'task_notification', 'error_notification'
      )),
      content TEXT NOT NULL,
      metadata JSONB,
      read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS coordination_workflow_history (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL,
      goal TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed', 'blocked')) DEFAULT 'pending',
      summary TEXT,
      result JSONB,
      error_message TEXT,
      initiated_by TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS workflow_step_executions (
      id TEXT PRIMARY KEY,
      workflow_history_id TEXT NOT NULL REFERENCES coordination_workflow_history(id) ON DELETE CASCADE,
      step_id TEXT NOT NULL,
      step_text TEXT NOT NULL,
      assigned_worker TEXT,
      status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'completed', 'failed')) DEFAULT 'pending',
      result JSONB,
      error_message TEXT,
      started_at TIMESTAMPTZ,
      completed_at TIMESTAMPTZ,
      sort_order INTEGER NOT NULL,
      UNIQUE(workflow_history_id, step_id)
    );

    CREATE TABLE IF NOT EXISTS worker_errors (
      id TEXT PRIMARY KEY,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      worker_agent_id TEXT NOT NULL,
      workflow_id TEXT,
      error_message TEXT NOT NULL,
      error_category TEXT NOT NULL CHECK (error_category IN (
        'permission_denied', 'timeout', 'invalid_state', 'resource_error', 'unknown'
      )) DEFAULT 'unknown',
      severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
      retry_count INT NOT NULL DEFAULT 0,
      max_retries INT NOT NULL DEFAULT 3,
      retry_strategy TEXT NOT NULL DEFAULT 'exponential_backoff',
      next_retry_at TIMESTAMPTZ,
      stack_trace TEXT,
      context JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mcp_tools (
      id TEXT PRIMARY KEY,
      team_id TEXT REFERENCES coordination_teams(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('browser', 'github', 'slack', 'database', 'api', 'custom')),
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      auth_type TEXT NOT NULL DEFAULT 'none' CHECK (auth_type IN ('none', 'api_key', 'oauth', 'token', 'custom')),
      config JSONB NOT NULL DEFAULT '{}',
      source_url TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(team_id, name)
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_access (
      id TEXT PRIMARY KEY,
      mcp_tool_id TEXT NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
      worker_agent_id TEXT,
      team_id TEXT NOT NULL REFERENCES coordination_teams(id) ON DELETE CASCADE,
      access_level TEXT NOT NULL CHECK (access_level IN ('denied', 'limited', 'full')) DEFAULT 'denied',
      rate_limit INT,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS mcp_tool_calls (
      id TEXT PRIMARY KEY,
      mcp_tool_id TEXT NOT NULL REFERENCES mcp_tools(id) ON DELETE CASCADE,
      worker_agent_id TEXT NOT NULL,
      function_name TEXT NOT NULL,
      arguments JSONB,
      result JSONB,
      error_message TEXT,
      duration_ms INT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_coordination_messages_team_to ON coordination_messages(team_id, to_agent_id, read);
    CREATE INDEX IF NOT EXISTS idx_coordination_messages_from ON coordination_messages(from_agent_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_coordination_agents_team_status ON coordination_agents(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_coordination_workflow_team_status ON coordination_workflow_history(team_id, status);
    CREATE INDEX IF NOT EXISTS idx_coordination_workflow_initiated_by ON coordination_workflow_history(initiated_by, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_workflow_step_exec_worker ON workflow_step_executions(assigned_worker, status);
    CREATE INDEX IF NOT EXISTS idx_worker_errors_team ON worker_errors(team_id);
    CREATE INDEX IF NOT EXISTS idx_worker_errors_worker ON worker_errors(worker_agent_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_worker_errors_retry ON worker_errors(next_retry_at) WHERE next_retry_at IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_worker_errors_severity ON worker_errors(severity, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_tools_team ON mcp_tools(team_id);
    CREATE INDEX IF NOT EXISTS idx_mcp_tools_type ON mcp_tools(type);
    CREATE INDEX IF NOT EXISTS idx_mcp_access_worker ON mcp_tool_access(worker_agent_id, access_level);
    CREATE INDEX IF NOT EXISTS idx_mcp_calls_tool ON mcp_tool_calls(mcp_tool_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_mcp_calls_worker ON mcp_tool_calls(worker_agent_id, created_at DESC);
      `);
            return;
        }
        catch (error) {
            const shouldRetry = attempt < retries && isRetryableStartupError(error);
            if (!shouldRetry)
                throw error;
            const expBackoff = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
            const jitter = Math.floor(Math.random() * 100);
            const delayMs = expBackoff + jitter;
            console.warn(`[db] Postgres not ready (${isPgErrorWithCode(error) ? error.code : 'unknown'}). Retrying init in ${delayMs}ms (${attempt + 1}/${retries + 1})...`);
            await closePool();
            await sleep(delayMs);
        }
    }
}

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
const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: process.env.PGSSLMODE === 'require' ? { rejectUnauthorized: false } : undefined,
});
export async function query(text, params = []) {
    return pool.query(text, params);
}
export async function withTransaction(fn) {
    const client = await pool.connect();
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
    await pool.query(`
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (conversation_id, sort_order)
    );

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
    await pool.query(`
    ALTER TABLE conversations ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;
    ALTER TABLE agent_todos ADD COLUMN IF NOT EXISTS owner_id TEXT REFERENCES app_users(id) ON DELETE CASCADE;
  `);
    await pool.query(`
    INSERT INTO app_users (id, display_name, created_at, updated_at)
    VALUES ('legacy-local', 'Local legacy', NOW(), NOW())
    ON CONFLICT (id) DO NOTHING;
  `);
    await pool.query(`
    UPDATE conversations
    SET owner_id = 'legacy-local'
    WHERE owner_id IS NULL;

    UPDATE agent_todos
    SET owner_id = 'legacy-local'
    WHERE owner_id IS NULL;
  `);
    await pool.query(`
    ALTER TABLE conversations ALTER COLUMN owner_id SET NOT NULL;
    ALTER TABLE agent_todos ALTER COLUMN owner_id SET NOT NULL;
  `);
    await pool.query(`
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
    await pool.query(`
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
    // Contexto e Persistência de Conversa
    await pool.query(`
    CREATE TABLE IF NOT EXISTS conversation_context (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      context_type TEXT NOT NULL CHECK (context_type IN (
        'exchange_rate', 'api_response', 'agent_state', 'user_preference', 'metadata', 'other'
      )),
      key TEXT NOT NULL,
      value JSONB NOT NULL,
      expires_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(conversation_id, context_type, key)
    );

    CREATE TABLE IF NOT EXISTS api_calls_cache (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      api_name TEXT NOT NULL,
      endpoint TEXT,
      request_params JSONB NOT NULL,
      response_data JSONB NOT NULL,
      status_code INT,
      error_message TEXT,
      source_agent TEXT,
      cached_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ,
      UNIQUE(conversation_id, api_name, endpoint, request_params)
    );

    CREATE TABLE IF NOT EXISTS agent_response_history (
      id TEXT PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      responding_agent TEXT NOT NULL,
      agent_role TEXT,
      response_type TEXT NOT NULL CHECK (response_type IN ('direct', 'follow_up', 'correction', 'support', 'clarification')),
      is_primary_responder BOOLEAN NOT NULL DEFAULT TRUE,
      confidence_level DECIMAL(3,2),
      response_source_data JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_support_chain (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      primary_agent TEXT NOT NULL,
      supporting_agent TEXT NOT NULL,
      support_type TEXT NOT NULL CHECK (support_type IN (
        'validation', 'data_source', 'correction', 'clarification', 'backup', 'expertise'
      )),
      support_content TEXT,
      support_data JSONB,
      feedback_type TEXT CHECK (feedback_type IN ('like', 'dislike', 'neutral', 'improved', 'corrected')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS agent_conversational_state (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      agent_name TEXT NOT NULL,
      agent_role TEXT,
      agent_emoji TEXT,
      is_active BOOLEAN DEFAULT FALSE,
      last_message_index INT,
      personality_state JSONB,
      expertise_context JSONB,
      recent_decisions JSONB,
      confidence_score DECIMAL(3,2),
      mood_indicator TEXT,
      support_provided_count INT DEFAULT 0,
      corrections_made INT DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(conversation_id, agent_name)
    );

    CREATE TABLE IF NOT EXISTS agent_interaction_graph (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      from_agent TEXT NOT NULL,
      to_agent TEXT NOT NULL,
      interaction_type TEXT NOT NULL CHECK (interaction_type IN (
        'supports', 'corrects', 'validates', 'questions', 'builds_on', 'disagrees', 'clarifies', 'provides_data'
      )),
      interaction_count INT DEFAULT 1,
      last_interaction_message_index INT,
      context_of_interaction TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(conversation_id, from_agent, to_agent, interaction_type)
    );

    CREATE TABLE IF NOT EXISTS message_traces (
      id TEXT PRIMARY KEY,
      message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      responding_agent TEXT,
      supporting_agents TEXT[],
      tool_calls JSONB,
      agent_reasoning JSONB,
      api_calls JSONB,
      performance_metrics JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS conversation_metadata (
      conversation_id TEXT PRIMARY KEY REFERENCES conversations(id) ON DELETE CASCADE,
      user_id TEXT NOT NULL REFERENCES app_users(id) ON DELETE CASCADE,
      last_accessed_agent TEXT,
      active_agents TEXT[],
      agent_sequence TEXT[],
      agent_participation_count JSONB,
      agent_support_map JSONB,
      context_summary TEXT,
      important_facts JSONB,
      user_preferences JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_context_conversation_type ON conversation_context(conversation_id, context_type);
    CREATE INDEX IF NOT EXISTS idx_context_key ON conversation_context(key);
    CREATE INDEX IF NOT EXISTS idx_context_expires ON conversation_context(expires_at) WHERE expires_at IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_api_cache_conversation ON api_calls_cache(conversation_id, api_name);
    CREATE INDEX IF NOT EXISTS idx_api_cache_user ON api_calls_cache(user_id, cached_at DESC);
    CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_calls_cache(expires_at) WHERE expires_at IS NOT NULL;
    
    CREATE INDEX IF NOT EXISTS idx_agent_response_message ON agent_response_history(message_id);
    CREATE INDEX IF NOT EXISTS idx_agent_response_conversation ON agent_response_history(conversation_id, responding_agent);
    CREATE INDEX IF NOT EXISTS idx_agent_response_agent ON agent_response_history(responding_agent, created_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_agent_support_primary ON agent_support_chain(conversation_id, primary_agent);
    CREATE INDEX IF NOT EXISTS idx_agent_support_supporting ON agent_support_chain(supporting_agent, support_type);
    CREATE INDEX IF NOT EXISTS idx_agent_support_message ON agent_support_chain(message_id);
    
    CREATE INDEX IF NOT EXISTS idx_agent_state_conversation ON agent_conversational_state(conversation_id, agent_name);
    CREATE INDEX IF NOT EXISTS idx_agent_state_active ON agent_conversational_state(conversation_id, is_active);
    CREATE INDEX IF NOT EXISTS idx_agent_state_user ON agent_conversational_state(user_id, updated_at DESC);
    
    CREATE INDEX IF NOT EXISTS idx_agent_interaction_conversation ON agent_interaction_graph(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_agent_interaction_from ON agent_interaction_graph(from_agent, interaction_type);
    CREATE INDEX IF NOT EXISTS idx_agent_interaction_to ON agent_interaction_graph(to_agent);
    
    CREATE INDEX IF NOT EXISTS idx_message_traces_message ON message_traces(message_id);
    CREATE INDEX IF NOT EXISTS idx_message_traces_conversation ON message_traces(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_message_traces_agent ON message_traces(responding_agent);
    
    CREATE INDEX IF NOT EXISTS idx_convo_metadata_user ON conversation_metadata(user_id);
  `);
}

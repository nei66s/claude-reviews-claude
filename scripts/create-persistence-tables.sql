-- Criar tabelas de persistência

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

-- Criar índices
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

CREATE INDEX IF NOT EXISTS idx_context_conversation_type ON conversation_context(conversation_id, context_type);
CREATE INDEX IF NOT EXISTS idx_context_key ON conversation_context(key);
CREATE INDEX IF NOT EXISTS idx_context_expires ON conversation_context(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_api_cache_conversation ON api_calls_cache(conversation_id, api_name);
CREATE INDEX IF NOT EXISTS idx_api_cache_user ON api_calls_cache(user_id, cached_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_cache_expires ON api_calls_cache(expires_at) WHERE expires_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_convo_metadata_user ON conversation_metadata(user_id);

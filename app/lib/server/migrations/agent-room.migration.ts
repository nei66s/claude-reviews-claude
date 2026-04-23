
/**
 * Migration SQL para Persistência da Sala de Convivência (Agent Room)
 */

const AGENT_ROOM_MIGRATION = `
-- Tabela de sessões da Sala de Convivência
CREATE TABLE IF NOT EXISTS public.agent_room_sessions (
  id TEXT PRIMARY KEY, -- Geralmente o ID do usuário ou um ID fixo "global"
  synergy_score INT NOT NULL DEFAULT 80,
  current_topic TEXT,
  last_activity_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de mensagens da Sala de Convivência (Persistência do Histórico)
CREATE TABLE IF NOT EXISTS public.agent_room_messages (
  id BIGSERIAL PRIMARY KEY,
  session_id TEXT NOT NULL REFERENCES public.agent_room_sessions(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('agent', 'user', 'system')),
  agent_id TEXT,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para carregar histórico rápido
CREATE INDEX IF NOT EXISTS idx_agent_room_msg_session_id ON public.agent_room_messages(session_id, created_at ASC);
`;

export default AGENT_ROOM_MIGRATION;

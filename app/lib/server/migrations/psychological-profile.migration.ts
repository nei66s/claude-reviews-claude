/**
 * Migration SQL para adicionar sistema de feedback e perfil psicológico
 * Execute isto no seu banco de dados PostgreSQL
 */

const PSYCHOLOGICAL_PROFILE_MIGRATION = `
-- Tabela de feedback de mensagens
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike', 'neutral')),
  feedback_text TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Tabela de perfil psicológico do usuário
CREATE TABLE IF NOT EXISTS public.user_psychological_profiles (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL UNIQUE REFERENCES public.app_users(id) ON DELETE CASCADE,
  tonal_preference TEXT NOT NULL DEFAULT 'balanced' CHECK (tonal_preference IN ('formal', 'casual', 'balanced')),
  depth_preference TEXT NOT NULL DEFAULT 'balanced' CHECK (depth_preference IN ('simplified', 'technical', 'balanced')),
  structure_preference TEXT NOT NULL DEFAULT 'mixed' CHECK (structure_preference IN ('narrative', 'list', 'mixed')),
  pace_preference TEXT NOT NULL DEFAULT 'balanced' CHECK (pace_preference IN ('fast', 'detailed', 'balanced')),
  example_type TEXT NOT NULL DEFAULT 'mixed' CHECK (example_type IN ('code', 'conceptual', 'mixed')),
  response_length TEXT NOT NULL DEFAULT 'balanced' CHECK (response_length IN ('brief', 'comprehensive', 'balanced')),
  confidence_score DECIMAL(3, 2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  total_feedback INT NOT NULL DEFAULT 0,
  like_count INT NOT NULL DEFAULT 0,
  dislike_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON public.message_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_conversation_id ON public.message_feedback(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_psychological_profiles_user_id ON public.user_psychological_profiles(user_id);
`;

export default PSYCHOLOGICAL_PROFILE_MIGRATION;

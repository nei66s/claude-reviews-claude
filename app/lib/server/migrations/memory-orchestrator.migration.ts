/**
 * Migration SQL para adicionar a base do Memory Orchestrator (lado Next).
 *
 * Objetivo: preparar estrutura mínima sem alterar fluxo atual de chat.
 * Observação: este projeto mantém migrations como SQL string para execução manual.
 */
const MEMORY_ORCHESTRATOR_MIGRATION = `
-- Itens de memória atômica centrados no usuário (não substitui agent_memories)
CREATE TABLE IF NOT EXISTS public.user_memory_items (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN (
    'declared_fact',
    'preference',
    'goal',
    'constraint',
    'interaction_style',
    'inferred_trait'
  )),
  category TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  normalized_value TEXT NOT NULL DEFAULT '',
  source_conversation_id TEXT NOT NULL,
  source_message_id BIGINT NULL,
  confidence_score DECIMAL(3, 2) NOT NULL DEFAULT 0.0 CHECK (confidence_score >= 0 AND confidence_score <= 1),
  relevance_score DECIMAL(3, 2) NOT NULL DEFAULT 0.0 CHECK (relevance_score >= 0 AND relevance_score <= 1),
  sensitivity_level TEXT NOT NULL DEFAULT 'low' CHECK (sensitivity_level IN ('low', 'medium', 'high', 'blocked')),
  status TEXT NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'active', 'archived', 'contradicted', 'deleted')),
  valid_from TIMESTAMPTZ NULL,
  valid_until TIMESTAMPTZ NULL,
  created_by TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- FKs (evitando acoplamento que quebre deletes existentes de conversas/mensagens)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memory_items_user_id_fk') THEN
    ALTER TABLE public.user_memory_items
      ADD CONSTRAINT user_memory_items_user_id_fk
      FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_memory_items_source_message_id_fk') THEN
    ALTER TABLE public.user_memory_items
      ADD CONSTRAINT user_memory_items_source_message_id_fk
      FOREIGN KEY (source_message_id) REFERENCES public.messages(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Índices básicos para lookup por usuário e status
CREATE INDEX IF NOT EXISTS idx_user_memory_items_user_status_updated
  ON public.user_memory_items (user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_items_user_type_category_updated
  ON public.user_memory_items (user_id, type, category, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_memory_items_source_conversation
  ON public.user_memory_items (source_conversation_id, created_at DESC);

-- Perfil consolidado (complementa user_psychological_profiles, não substitui)
CREATE TABLE IF NOT EXISTS public.user_profile (
  user_id TEXT PRIMARY KEY,
  summary_short TEXT NOT NULL DEFAULT '',
  summary_long TEXT NOT NULL DEFAULT '',
  interaction_preferences JSONB NOT NULL DEFAULT '{}'::jsonb,
  recurring_topics JSONB NOT NULL DEFAULT '[]'::jsonb,
  active_goals JSONB NOT NULL DEFAULT '[]'::jsonb,
  known_constraints JSONB NOT NULL DEFAULT '[]'::jsonb,
  key_facts JSONB NOT NULL DEFAULT '[]'::jsonb,
  profile_version INT NOT NULL DEFAULT 1,
  last_compiled_at TIMESTAMPTZ NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_profile_user_id_fk') THEN
    ALTER TABLE public.user_profile
      ADD CONSTRAINT user_profile_user_id_fk
      FOREIGN KEY (user_id) REFERENCES public.app_users(id) ON DELETE CASCADE;
  END IF;
END $$;

-- Auditoria de mudanças (trilha mínima)
CREATE TABLE IF NOT EXISTS public.memory_audit_log (
  id BIGSERIAL PRIMARY KEY,
  memory_item_id TEXT NOT NULL REFERENCES public.user_memory_items(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('created', 'promoted', 'updated', 'contradicted', 'archived', 'deleted')),
  previous_status TEXT NULL CHECK (previous_status IN ('candidate', 'active', 'archived', 'contradicted', 'deleted')),
  new_status TEXT NULL CHECK (new_status IN ('candidate', 'active', 'archived', 'contradicted', 'deleted')),
  reason TEXT NOT NULL DEFAULT '',
  actor TEXT NOT NULL DEFAULT 'system',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_memory_audit_log_user_created
  ON public.memory_audit_log (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_memory_audit_log_item_created
  ON public.memory_audit_log (memory_item_id, created_at DESC);

-- Governança de ingestão (Fase 12)
CREATE TABLE IF NOT EXISTS public.memory_ingestion_governance (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  message_id BIGINT NULL REFERENCES public.messages(id) ON DELETE SET NULL,
  conversation_id TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('processing', 'completed', 'skipped', 'error', 'rate_limited')),
  reason TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índice para verificar se mensagem já foi processada
CREATE UNIQUE INDEX IF NOT EXISTS idx_mig_message_id_unique
  ON public.memory_ingestion_governance (message_id)
  WHERE message_id IS NOT NULL;

-- Índice para rate-limit por usuário
CREATE INDEX IF NOT EXISTS idx_mig_user_created
  ON public.memory_ingestion_governance (user_id, created_at DESC);
`;

export default MEMORY_ORCHESTRATOR_MIGRATION;


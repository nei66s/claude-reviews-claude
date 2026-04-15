/**
 * Migration para adicionar IDs numéricos às mensagens
 * Estrutura: usuário > conversa > mensagens (com ID) > feedback
 */

const MESSAGE_IDS_MIGRATION = `
-- Se a coluna 'id' já existe em messages, pula
-- Adiciona ID numérico único para cada mensagem
ALTER TABLE public.messages 
ADD COLUMN IF NOT EXISTS id BIGSERIAL;

-- Se já não tem constraint, cria
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint 
    WHERE conname = 'messages_pkey' AND conrelname = 'messages'
  ) THEN
    ALTER TABLE public.messages ADD PRIMARY KEY (id);
  END IF;
END $$;

-- Criar índice para buscar por conversa
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages(conversation_id, sort_order);

-- Atualizar message_feedback para usar message_id como BIGINT/texto e manter compatibilidade
-- Se message_id é texto, deixa assim por enquanto (será usado como 'message-uuid' ou similar)
-- Mas adiciona uma coluna message_number para rastrear o ID numérico da mensagem quando existir

ALTER TABLE public.message_feedback 
ADD COLUMN IF NOT EXISTS message_number BIGINT REFERENCES public.messages(id) ON DELETE CASCADE;

-- Criar índice para melhor performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_number ON public.message_feedback(message_number);
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_conversation ON public.message_feedback(user_id, conversation_id);

-- Tabela de relacionamentos: conversa > mensagens > feedback
-- Garante que temos um caminho claro: user > conversations > messages > message_feedback

CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON public.conversations(owner_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id_sort ON public.messages(conversation_id, sort_order);
`;

export default MESSAGE_IDS_MIGRATION;

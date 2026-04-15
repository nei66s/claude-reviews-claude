-- Fix message_feedback schema to use TEXT for message_id instead of BIGINT
-- This allows storing generated message IDs (strings) instead of only numeric IDs

-- Drop dependent objects
DROP TABLE IF EXISTS public.message_feedback CASCADE;

-- Recreate with correct schema
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id BIGSERIAL PRIMARY KEY,
  message_id TEXT NOT NULL,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike', 'neutral')),
  feedback_text TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Create indices
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON public.message_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_conversation_id ON public.message_feedback(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_message_feedback_message_id ON public.message_feedback(message_id);

-- Verify
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'message_feedback'
ORDER BY ordinal_position;

-- Seed data para Doutora Kitty
-- Para executar: psql -h localhost -U admin -d chocks < doutora-kitty-seed.sql

-- Create the local-admin user (required by the auth system)
INSERT INTO public.app_users (id, display_name, created_at, updated_at)
VALUES ('local-admin', 'Local Admin', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.message_feedback 
  (message_id, conversation_id, user_id, feedback, feedback_text, created_at) 
VALUES
  ('msg-demo-001', 'demo-conv-1', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-002', 'demo-conv-1', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-003', 'demo-conv-1', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-004', 'demo-conv-2', 'local-admin', 'dislike', 'Muito formal, prefiro tom casual', NOW()),
  ('msg-demo-005', 'demo-conv-2', 'local-admin', 'dislike', 'Muito longo, quero respostas concisas', NOW()),
  ('msg-demo-006', 'demo-conv-3', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-007', 'demo-conv-3', 'local-admin', 'dislike', 'Precisa de mais exemplos técnicos', NOW()),
  ('msg-demo-008', 'demo-conv-4', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-009', 'demo-conv-4', 'local-admin', 'like', NULL, NOW()),
  ('msg-demo-010', 'demo-conv-5', 'local-admin', 'dislike', 'Muito técnico, quer dizer simples', NOW())
ON CONFLICT (message_id, user_id) DO NOTHING;

INSERT INTO public.user_psychological_profiles
  (user_id, tonal_preference, depth_preference, structure_preference, pace_preference, 
   example_type, response_length, confidence_score, total_feedback, like_count, dislike_count)
VALUES 
  ('local-admin', 'casual', 'simplified', 'list', 'balanced', 'mixed', 'brief', 0.65, 10, 6, 4)
ON CONFLICT (user_id) DO UPDATE SET
  tonal_preference = 'casual',
  depth_preference = 'simplified',
  structure_preference = 'list',
  pace_preference = 'balanced',
  example_type = 'mixed',
  response_length = 'brief',
  confidence_score = 0.65,
  total_feedback = 10,
  like_count = 6,
  dislike_count = 4,
  updated_at = NOW();

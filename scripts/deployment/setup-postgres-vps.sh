#!/bin/bash

# Script para instalar PostgreSQL e configurar banco no VPS
# Uso: sudo bash setup-postgres-vps.sh [password]

set -e

# Cores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Defaults
DB_USER="postgres"
DB_PASSWORD="${1:-postgres}"
DB_NAME="chocks"
DB_HOST="localhost"
DB_PORT="5432"

echo -e "${YELLOW}=== Instalando PostgreSQL no VPS ===${NC}"

# 1. Atualizar packages
echo -e "${YELLOW}[1/8] Atualizando package manager...${NC}"
apt-get update -qq
apt-get upgrade -y -qq

# 2. Instalar PostgreSQL
echo -e "${YELLOW}[2/8] Instalando PostgreSQL...${NC}"
apt-get install -y -qq postgresql postgresql-contrib

# 3. Iniciar PostgreSQL
echo -e "${YELLOW}[3/8] Iniciando PostgreSQL...${NC}"
systemctl start postgresql
systemctl enable postgresql

# 4. Criar usuário com senha
echo -e "${YELLOW}[4/8] Configurando usuário PostgreSQL...${NC}"
sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$DB_PASSWORD';" || true

# 5. Criar banco de dados
echo -e "${YELLOW}[5/8] Criando banco de dados '$DB_NAME'...${NC}"
sudo -u postgres createdb $DB_NAME 2>/dev/null || echo "Banco já existe, pulando..."

# 6. Criar tabelas base
echo -e "${YELLOW}[6/8] Criando tabelas base...${NC}"
sudo -u postgres psql -d $DB_NAME <<EOF
-- Tabela de usuários
CREATE TABLE IF NOT EXISTS public.app_users (
  id TEXT PRIMARY KEY,
  email VARCHAR(255) UNIQUE,
  display_name TEXT NOT NULL,
  avatar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de conversas
CREATE TABLE IF NOT EXISTS public.conversations (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabela de mensagens
CREATE TABLE IF NOT EXISTS public.messages (
  id BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  sort_order INTEGER NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'agent')),
  content TEXT NOT NULL DEFAULT '',
  agent_id TEXT,
  helper_agent_id TEXT,
  handoff_label TEXT,
  collaboration_label TEXT,
  trace_json JSONB,
  streaming BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (conversation_id, sort_order)
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_messages_conversation_id ON public.messages (conversation_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_conversations_owner_id ON public.conversations (owner_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_users_email ON public.app_users (email);

-- Tabela de feedback de mensagens
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

-- Tabela de perfil psicológico
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

-- Índices para feedback e perfil
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON public.message_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_conversation_id ON public.message_feedback(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_psychological_profiles_user_id ON public.user_psychological_profiles(user_id);

-- Tabela de audit logs
CREATE TABLE IF NOT EXISTS public.audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES public.app_users(id) ON DELETE SET NULL,
  level TEXT NOT NULL CHECK (level IN ('info', 'warn', 'error')),
  message TEXT NOT NULL,
  data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON public.audit_logs(user_id, created_at DESC);

-- Garantir colunas de identidade do agente em bases já existentes
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS agent_id TEXT,
  ADD COLUMN IF NOT EXISTS helper_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS handoff_label TEXT,
  ADD COLUMN IF NOT EXISTS collaboration_label TEXT;

GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO $DB_USER;
GRANT USAGE, CREATE ON SCHEMA public TO $DB_USER;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO $DB_USER;
EOF

echo -e "${GREEN}[6/8] Tabelas criadas com sucesso!${NC}"

# 7. Configurar PostgreSQL para aceitar conexões remotas
echo -e "${YELLOW}[7/8] Configurando acesso remoto...${NC}"

# Encontrar arquivo postgresql.conf
POSTGRES_CONF=$(sudo -u postgres psql -t -c "SHOW config_file;")
POSTGRES_HBA=$(dirname "$POSTGRES_CONF")/pg_hba.conf

# Backup
sudo cp "$POSTGRES_CONF" "${POSTGRES_CONF}.bak"
sudo cp "$POSTGRES_HBA" "${POSTGRES_HBA}.bak"

# Permitir conexões de qualquer lugar
sudo sed -i "s/#listen_addresses = 'localhost'/listen_addresses = '*'/g" "$POSTGRES_CONF"

# Adicionar acesso remoto ao pg_hba.conf
if ! sudo grep -q "0.0.0.0/0" "$POSTGRES_HBA"; then
  echo "host    all             all             0.0.0.0/0               md5" | sudo tee -a "$POSTGRES_HBA" > /dev/null
fi

# Reiniciar PostgreSQL
sudo systemctl restart postgresql
echo -e "${GREEN}[7/8] PostgreSQL configurado!${NC}"

# 8. Gerar .env
echo -e "${YELLOW}[8/8] Gerando arquivo .env...${NC}"

# Use localhost para conexão local
LOCAL_HOST="127.0.0.1"
DATABASE_URL="postgresql://${DB_USER}:${DB_PASSWORD}@${LOCAL_HOST}:${DB_PORT}/${DB_NAME}"

# Determinar caminho do .env
ENV_FILE="/root/claude-reviews-claude/.env"
if [ ! -f "$ENV_FILE" ]; then
  ENV_FILE=".env"
fi

# Criar/atualizar .env
cat > "$ENV_FILE" <<ENVFILE
# PostgreSQL Database URL (LOCAL ONLY)
DATABASE_URL=$DATABASE_URL

# PostgreSQL config (opcional)
DB_HOST=$LOCAL_HOST
DB_PORT=$DB_PORT
DB_USER=$DB_USER
DB_PASSWORD=$DB_PASSWORD
DB_NAME=$DB_NAME

# OpenAI (se tiver)
# OPENAI_API_KEY=your_api_key_here

ENVFILE

echo -e "${GREEN}[8/8] .env criado!${NC}"

# Summary
echo ""
echo -e "${GREEN}=== ✅ PostgreSQL instalado e configurado! ===${NC}"
echo ""
echo -e "${YELLOW}📋 Informações de Conexão:${NC}"
echo -e "  Host: ${GREEN}$LOCAL_HOST${NC}"
echo -e "  Porta: ${GREEN}$DB_PORT${NC}"
echo -e "  Banco: ${GREEN}$DB_NAME${NC}"
echo -e "  Usuário: ${GREEN}$DB_USER${NC}"
echo -e "  Senha: ${GREEN}$DB_PASSWORD${NC}"
echo ""
echo -e "${YELLOW}📝 DATABASE_URL:${NC}"
echo -e "  ${GREEN}$DATABASE_URL${NC}"
echo ""
echo -e "${YELLOW}📁 .env localizado em:${NC}"
echo -e "  ${GREEN}$ENV_FILE${NC}"
echo ""
echo -e "${YELLOW}✅ Próximos passos:${NC}"
echo "  1. Verificar conexão: psql -h $LOCAL_HOST -U $DB_USER -d $DB_NAME"
echo "  2. Testar com: npm run dev"
echo ""

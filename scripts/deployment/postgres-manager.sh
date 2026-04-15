#!/bin/bash

# 🗄️ PostgreSQL VPS Management Script
# Uso: bash postgres-manager.sh [comando]

set -e

BACKUP_DIR="/backups/postgresql"
DB_NAME="chocks"
DB_USER="postgres"
DB_HOST="127.0.0.1"
DB_PORT="5432"

# Cores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Functions
print_header() {
  echo -e "${BLUE}▶ $1${NC}"
}

success() {
  echo -e "${GREEN}✅ $1${NC}"
}

error() {
  echo -e "${RED}❌ $1${NC}"
  exit 1
}

warning() {
  echo -e "${YELLOW}⚠️  $1${NC}"
}

# Help
show_help() {
  cat <<EOF
🗄️  PostgreSQL VPS Manager

Uso: bash postgres-manager.sh [comando]

Comandos:
  status              Ver status do PostgreSQL
  logs                Ver últimos logs
  backup              Fazer backup do banco
  restore FILE        Restaurar banco de arquivo
  restart             Reiniciar PostgreSQL
  reload              Recarregar configuração
  password            Mudar senha do postgres
  test-db             Testar conexão banco
  stats               Ver estatísticas do banco
  help                Mostrar esta ajuda

Exemplos:
  bash postgres-manager.sh status
  bash postgres-manager.sh backup
  bash postgres-manager.sh restore backup.sql
EOF
}

# Status
cmd_status() {
  print_header "Status do PostgreSQL"
  sudo systemctl status postgresql | grep -E "Active|Loaded|Main"
  echo ""
  print_header "Processos postgres"
  ps aux | grep "[p]ostgres" | wc -l
  echo "processos rodando"
}

# Logs
cmd_logs() {
  print_header "Últimos 50 logs PostgreSQL"
  sudo tail -50 /var/log/postgresql/postgresql-16-main.log
}

# Backup
cmd_backup() {
  print_header "Iniciando backup..."
  
  mkdir -p "$BACKUP_DIR"
  TIMESTAMP=$(date +%Y%m%d_%H%M%S)
  BACKUP_FILE="$BACKUP_DIR/chocks_${TIMESTAMP}.sql"
  
  warning "Fazendo backup de: $DB_NAME"
  
  sudo -u postgres pg_dump "$DB_NAME" > "$BACKUP_FILE" || error "Backup falhou!"
  
  SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
  success "Backup concluído: $BACKUP_FILE ($SIZE)"
  
  # Comprimir
  print_header "Comprimindo backup..."
  gzip "$BACKUP_FILE"
  success "Backup comprimido: ${BACKUP_FILE}.gz"
}

# Restore
cmd_restore() {
  if [ -z "$1" ]; then
    error "Arquivo de backup não especificado!"
  fi
  
  BACKUP_FILE="$1"
  
  if [ ! -f "$BACKUP_FILE" ]; then
    error "Arquivo não encontrado: $BACKUP_FILE"
  fi
  
  # Descomprimir se necessário
  if [[ "$BACKUP_FILE" == *.gz ]]; then
    print_header "Descomprimindo..."
    gunzip -c "$BACKUP_FILE" > /tmp/restore.sql
    BACKUP_FILE="/tmp/restore.sql"
  fi
  
  print_header "Restaurando banco..."
  warning "Isso vai SOBRESCREVER o banco existente!"
  read -p "Tem certeza? (s/n): " -n 1 -r
  echo
  if [[ $REPLY =~ ^[Ss]$ ]]; then
    sudo -u postgres psql "$DB_NAME" < "$BACKUP_FILE" || error "Restore falhou!"
    success "Banco restaurado com sucesso!"
  else
    warning "Restore cancelado"
  fi
}

# Restart
cmd_restart() {
  print_header "Reiniciando PostgreSQL..."
  sudo systemctl restart postgresql
  sleep 2
  success "PostgreSQL reiniciado!"
}

# Reload
cmd_reload() {
  print_header "Recarregando configuração..."
  sudo -u postgres /usr/lib/postgresql/16/bin/pg_ctl reload -D /var/lib/postgresql/16/main
  success "Configuração recarregada!"
}

# Password
cmd_password() {
  print_header "Alterar senha do postgres"
  read -sp "Nova senha: " PASSWORD
  echo
  read -sp "Confirmar senha: " PASSWORD_CONFIRM
  echo
  
  if [ "$PASSWORD" != "$PASSWORD_CONFIRM" ]; then
    error "Senhas não coincidem!"
  fi
  
  sudo -u postgres psql -c "ALTER USER postgres PASSWORD '$PASSWORD';"
  success "Senha alterada com sucesso!"
}

# Test DB
cmd_test_db() {
  print_header "Testando conexão banco..."
  
  sudo -u postgres psql -d "$DB_NAME" -c "SELECT version();" | head -3
  echo ""
  success "Conexão OK!"
  
  echo ""
  print_header "Tabelas do banco:"
  sudo -u postgres psql -d "$DB_NAME" -c "\dt"
}

# Stats
cmd_stats() {
  print_header "Estatísticas do banco $DB_NAME"
  
  echo ""
  echo "Tamanho total:"
  sudo -u postgres psql -d "$DB_NAME" -c "SELECT pg_size_pretty(pg_database_size('$DB_NAME')) as size;"
  
  echo ""
  echo "Tabelas:"
  sudo -u postgres psql -d "$DB_NAME" -c "SELECT schemaname, tablename, pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size FROM pg_tables WHERE schemaname='public' ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;"
  
  echo ""
  echo "Índices:"
  sudo -u postgres psql -d "$DB_NAME" -c "SELECT * FROM pg_stat_user_indexes;"
}

# Main
case "${1:-help}" in
  status)
    cmd_status
    ;;
  logs)
    cmd_logs
    ;;
  backup)
    cmd_backup
    ;;
  restore)
    cmd_restore "$2"
    ;;
  restart)
    cmd_restart
    ;;
  reload)
    cmd_reload
    ;;
  password)
    cmd_password
    ;;
  test-db)
    cmd_test_db
    ;;
  stats)
    cmd_stats
    ;;
  help)
    show_help
    ;;
  *)
    error "Comando desconhecido: $1"
    ;;
esac

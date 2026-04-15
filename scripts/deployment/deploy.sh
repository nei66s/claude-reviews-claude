#!/bin/bash

# Deploy Script - Atualiza produção rapidamente
# Uso: ./deploy.sh "mensagem de commit"

set -e

if [ -z "$1" ]; then
    echo "❌ Erro: Forneça uma mensagem de commit"
    echo "Uso: ./deploy.sh \"sua mensagem de commit\""
    exit 1
fi

COMMIT_MSG="$1"
echo "🚀 Iniciando deploy para produção..."
echo ""

# 1. Commit mudanças
echo "📝 [1/6] Commitando mudanças..."
git add -A
git commit -m "$COMMIT_MSG" || echo "⚠️  Nenhuma mudança para commitar"
echo "✅ Commit feito"
echo ""

# 2. Push para git
echo "⬆️  [2/6] Fazendo push para GitHub..."
git push origin main
echo "✅ Push realizado"
echo ""

# 3. Pull mudanças no servidor
echo "⬇️  [3/6] Puxando mudanças..."
cd /root/claude-reviews-claude
git pull origin main
echo "✅ Código atualizado"
echo ""

# 4. Instalar dependências
echo "📦 [4/6] Instalando dependências (Next.js)..."
npm install --omit=dev --no-save
echo "✅ Dependências instaladas"
echo ""

# 5. Build
echo "🔨 [5/6] Buildando aplicação..."
npm run build
echo "✅ Build realizado"
echo ""

# 6. Restart serviços
echo "🔄 [6/6] Reiniciando serviços PM2..."
pm2 restart chocks agent-ts --wait-ready
pm2 save
echo "✅ Serviços reiniciados"
echo ""

echo "🎉 Deploy concluído com sucesso!"
echo ""
echo "Status:"
pm2 status
echo ""
echo "📱 App disponível em: https://pimpotasma.com.br"

# 🚀 Chocks: Seu Coworker Pessoal com OpenAI

**Use seu computador + OpenAI API como assistente multi-agente sem pagar por subscriptions caras.**

## Setup em 5 minutos

### Pré-requisitos

- Node.js 18+ ([download](https://nodejs.org/))
- PostgreSQL local OU Docker ([guia abaixo](#banco-de-dados))
- Sua própria OpenAI API Key ([get here](https://platform.openai.com/api-keys))

### 1. Get OpenAI API Key
- Vá para [https://platform.openai.com/api-keys](https://platform.openai.com/api-keys)
- Crie uma chave nova
- Copie (você vai usar já)

### 2. Setup Banco de Dados

Escolha **UM** desses:

#### Opção A: PostgreSQL Local (recomendado)
```bash
# macOS com Homebrew
brew install postgresql@15
brew services start postgresql@15

# Criar banco
createdb chocks

# Usuário default
# user: postgres
# password: (leave empty or set one)
```

Depois, adicione ao `.env.local`:
```
DATABASE_URL=postgresql://postgres@127.0.0.1:5432/chocks
```

#### Opção B: PostgreSQL com Docker (mais fácil)
```bash
docker run -d \
  --name chocks-postgres \
  -e POSTGRES_PASSWORD=mysecret \
  -e POSTGRES_DB=chocks \
  -p 5432:5432 \
  postgres:15
```

Depois, adicione ao `.env.local`:
```
DATABASE_URL=postgresql://postgres:mysecret@localhost:5432/chocks
```

#### Opção C: PostgreSQL Cloud (Neon, Railway, Supabase)
- Crie uma conta em um desses serviços
- Copie a connection string
- Cole em `.env.local`:
```
DATABASE_URL=postgresql://user:password@cloud-server.com/chocks
```

---

### 3. Configure o projeto

```bash
cd agent-ts

# Copy template
cp .env.example .env.local

# Edit .env.local com:
# - Sua OPENAI_API_KEY
# - Seu DATABASE_URL (escolha de cima)

nano .env.local  # ou abra com seu editor
```

Exemplo de `.env.local` completo:
```env
OPENAI_API_KEY=sk-proj-your-key-here
OPENAI_MODEL=gpt-4-turbo
DATABASE_URL=postgresql://postgres@localhost:5432/chocks
PORT=3001
PROJECT_ROOT=..
```

### 4. Instale e rode

```bash
npm install
npm run dev
```

Output esperado:
```
[INIT] Loading persistent state from database...
[INIT] ✅ Persistent state loaded successfully
[JOBS] ✅ Background jobs started
Listening on http://localhost:3001
```

**Acesse**: http://localhost:3001

## Próximos passos

### Entender a arquitetura

- [QueryEngine](./src/queryEngine.ts) - núcleo que controla agentes
- [Tools](./src/tools.ts) - 42+ ferramentas disponíveis  
- [Coordinator](./src/coordination/index.ts) - multi-agent spawner
- [Documentação completa](./README_COORDINATION.md)

### Criar seus agentes

```typescript
// Exemplo: /create-agents
POST /api/coordination/spawn
{
  "agentCount": 2,
  "config": {
    "names": ["Research", "Analysis"],
    "systemPrompts": [...]
  }
}
```

### Otimizar custos

```env
# Limite loops de ferramentas
MAX_TOOL_LOOPS=6

# Restrinja bash/web (segurança)
ALLOW_BASH_EXEC=false
ALLOW_WEB_FETCH=false

# Monitor real-time
GET /api/cost/tracking
```

## Diagrama: Como funciona

```
┌─────────────┐
│   You (UI)  │
└──────┬──────┘
       │
       ├─→ /chat/stream
       │
┌──────┴──────────────┐
│   QueryEngine       │ (seu controlador central)
│   ├─ LLM calls      │
│   ├─ Tool exec      │
│   ├─ Cost tracking  │
│   └─ Coord manager  │
└──────┬──────────────┘
       │
       ├─→ OpenAI API (pay for tokens used)
       ├─→ File System (local)
       ├─→ Bash Execute (if enabled)
       ├─→ Search (local files)
       └─→ Coordinator (spawn sub-agents)
```

## Workflow: Seu primeiro "cowork session"

1. **Crie um novo chat**
   - Click "Nova Conversa"

2. **Descreva sua tarefa**
   - "Analise meu código TypeScript em `src/`"
   - "Crie 3 agentes: Research, Analysis, Summarizer"

3. **Deixe os agentes trabalharem**
   - Query Engine coordena
   - Ferramentas executam (files, search, etc)
   - OpenAI processa com sua chave

4. **Monitore custos**
   - Cada token é rastreado
   - Veja quanto gastou em tempo real

## Troubleshooting

### ❌ "EADDRINUSE: port 3001"
```bash
# Windows PowerShell
Stop-Process -Id (Get-NetTCPConnection -LocalPort 3001).OwningProcess -Force

# macOS/Linux
lsof -ti:3001 | xargs kill -9
```

### ❌ "Invalid API key"
- Verifique se `.env.local` tem a chave correta
- Teste: `echo $env:OPENAI_API_KEY` (Windows) ou `echo $OPENAI_API_KEY` (Unix)

### ❌ "database connection failed"
```bash
# Verifique se PostgreSQL está rodando
psql -U postgres -d chocks -c "SELECT 1"

# Se não funcionar, verifique DATABASE_URL em .env.local
```

### ❌ "Connection refused on localhost:5432"
PostgreSQL não está rodando. Escolha uma opção acima (A, B, ou C) e inicie.

## Recursos

- [Full Coordination Guide](./COORDINATION_GUIDE.md)
- [Architecture Docs](../architecture/)
- [API Reference](./README_COORDINATION.md)

---

**Dica**: Comece simples com 1 agente. Depois expande pra workflows complexos.

Bom uso! 🎯

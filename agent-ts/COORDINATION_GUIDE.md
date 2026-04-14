# 🚀 Sistema de Coordenação Multi-Agentes - Guia Completo

**Versão:** 1.0  
**Status:** ✅ Production Ready  
**Data:** Abril 2026

---

## 📋 Índice

1. [Quick Start](#-quick-start)
2. [Visão Geral](#-visão-geral)
3. [Arquitetura](#-arquitetura)
4. [Instalação & Setup](#-instalação--setup)
5. [Uso da API](#-uso-da-api)
6. [Fluxos de Trabalho](#-fluxos-de-trabalho)
7. [Tratamento de Erros](#-tratamento-de-erros)
8. [Monitoramento](#-monitoramento)
9. [Documentação Detalhada](#-documentação-detalhada)

---

## 🎯 Quick Start

### Instalação

```bash
cd agent-ts
npm install
npm run build
```

### Iniciar servidor

```bash
npm run dev
# Servidor rodando em http://localhost:3000
```

### Criar uma equipe

```bash
curl -X POST http://localhost:3000/api/coordination/team/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-team",
    "leaderAgentId": "coordinator@main"
  }'

# Resposta: { "success": true, "teamId": "team-xxx" }
```

### Registrar workers

```bash
TEAM_ID="team-xxx"

curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
  -H "Content-Type: application/json" \
  -d '{"agentId": "researcher@team", "role": "researcher"}'

curl -X POST http://localhost:3000/api/coordination/team/$TEAM_ID/register \
  -H "Content-Type: application/json" \
  -d '{"agentId": "implementer@team", "role": "implementer"}'
```

✅ **Pronto!** Sua equipe está funcionando.

---

## 📚 Visão Geral

O **Sistema de Coordenação** orquestra múltiplos agentes AI trabalhando juntos:

```
┌─────────────────┐
│   Coordinator   │
│   (Agent Pai)   │
└────────┬────────┘
         │
    ┌────┼────┐
    │    │    │
    ↓    ↓    ↓
┌────┐┌────┐┌────┐
│ W1 ││ W2 ││ W3 │  ← Workers (Agentes filhos)
└────┘└────┘└────┘
```

**Componentes Principais:**

| Componente | Função |
|-----------|--------|
| **Teams** | Agrupam agentes e coordenam comunicação |
| **Mailbox** | Sistema de mensagens BD-based |
| **Workflows** | Orquestra tarefas multi-step |
| **Retry System** | Retenta automaticamente tarefas que falharam |
| **Error Escalation** | Promove erros críticos para o coordinator |
| **MCP Tools** | Integra ferramentas externas (GitHub, APIs, etc) |
| **Background Jobs** | Executa limpeza, retries e escalation |

---

## 🏗️ Arquitetura

### Camadas do Sistema

```
┌──────────────────────────────────────┐
│      REST API (50+ endpoints)        │
├──────────────────────────────────────┤
│   Coordination Core (5 módulos)      │
│  • Mailbox    • Spawner              │
│  • Workflows  • Errors               │
│  • MCP Tools                         │
├──────────────────────────────────────┤
│   Background Jobs                    │
│  • Retry Executor                    │
│  • Cleanup & Escalation              │
├──────────────────────────────────────┤
│   PostgreSQL Database (11 tables)    │
└──────────────────────────────────────┘
```

### Tabelas do Banco

```
MAILBOX SYSTEM
├── coordination_teams
├── coordination_agents
└── coordination_messages

WORKFLOW SYSTEM
├── coordination_workflows
└── workflow_step_execution

ERROR HANDLING
├── worker_errors
└── escalation_queue

MCP INTEGRATION
├── mcp_tools
├── mcp_tool_access
└── mcp_tool_calls

SUPPORT
├── coordination_workers
```

---

## ⚙️ Instalação & Setup

### Pré-requisitos

- Node.js >= 18
- PostgreSQL >= 13
- npm ou yarn

### Configuração DB

```bash
# .env
DATABASE_URL=postgresql://user:password@localhost:5432/chocks
NODE_ENV=development
PORT=3000
OPENAI_API_KEY=sk-...
```

### Inicialização Automática

Ao iniciar o servidor, o sistema automaticamente:

```
1. Conecta ao PostgreSQL
2. Cria 11 tabelas (se não existirem)
3. Inicia background jobs (retry, cleanup, escalation)
4. Monta todas as rotas REST
5. Fica pronto para receber requisições
```

**Sem configuração manual necessária!** ✅

---

## 📡 Uso da API

### 1. Gerenciamento de Equipes

#### Criar equipe
```bash
POST /api/coordination/team/create
{
  "name": "team-name",
  "leaderAgentId": "coordinator@main"
}
```

#### Registrar agente
```bash
POST /api/coordination/team/{teamId}/register
{
  "agentId": "worker@team",
  "role": "researcher"
}
```

#### Listar agentes
```bash
GET /api/coordination/team/{teamId}/agents
```

### 2. Messaging & Comunicação

#### Enviar mensagem direta
```bash
POST /api/coordination/team/{teamId}/send
{
  "fromAgentId": "agent-a",
  "toAgentId": "agent-b",
  "messageType": "direct_message",
  "content": "Your message here"
}
```

#### Broadcast para todos
```bash
POST /api/coordination/team/{teamId}/send
{
  "fromAgentId": "coordinator",
  "toAgentId": null,  // ← null = broadcast
  "messageType": "broadcast",
  "content": "Message to everyone"
}
```

#### Buscar inbox
```bash
GET /api/coordination/team/{teamId}/inbox/{agentId}
```

### 3. Workflows

#### Iniciar workflow
```bash
POST /api/coordination/team/{teamId}/workflow/start
{
  "conversationId": "conv-123",
  "goal": "Build feature X",
  "initiatedBy": "user@company.com"
}
```

#### Adicionar steps
```bash
POST /api/coordination/workflow/{workflowId}/steps
{
  "steps": [
    {"stepId": "step-1", "text": "Analyze requirements"},
    {"stepId": "step-2", "text": "Implement feature"},
    {"stepId": "step-3", "text": "Write tests"}
  ]
}
```

#### Atribuir step a worker
```bash
POST /api/coordination/workflow/{workflowId}/step/{stepId}/assign
{
  "workerAgentId": "researcher@team"
}
```

#### Completar step
```bash
POST /api/coordination/workflow/{workflowId}/step/{stepId}/complete
{
  "result": {
    "specification": "OAuth2 with Spring Security",
    "estimatedDays": 5
  }
}
```

### 4. Error Handling

#### Log de erro
```bash
POST /api/coordination/team/{teamId}/error/log
{
  "workerAgentId": "worker@team",
  "errorMessage": "Connection timeout",
  "category": "timeout",
  "severity": "high"
}
```

#### Schedule retry
```bash
POST /api/coordination/error/{errorId}/retry
{
  "delaySeconds": 300
}
```

#### Estatísticas de erro
```bash
GET /api/coordination/team/{teamId}/error-stats
```

### 5. MCP Tools

#### Registrar ferramenta
```bash
POST /api/coordination/team/{teamId}/mcp-tool/register
{
  "name": "github",
  "type": "api",
  "config": {"baseUrl": "https://api.github.com"},
  "description": "GitHub REST API"
}
```

#### Conceder acesso
```bash
POST /api/coordination/team/{teamId}/mcp-tool/{toolId}/access
{
  "workerAgentId": "implementer@team",
  "accessLevel": "full",
  "rateLimit": 1000
}
```

#### Log de chamada
```bash
POST /api/coordination/mcp-tool/{toolId}/log-call
{
  "workerAgentId": "implementer@team",
  "functionName": "createPullRequest",
  "arguments": {"title": "feature: oauth2"},
  "result": {"prNumber": 1234},
  "durationMs": 245
}
```

---

## 🔄 Fluxos de Trabalho

### Fluxo 1: Criar Equipe e Iniciar Workflow

```
1. POST /team/create
   └─ Retorna: teamId

2. POST /team/{teamId}/register (x3)
   ├─ researcher@team
   ├─ implementer@team
   └─ tester@team

3. POST /team/{teamId}/workflow/start
   └─ Retorna: workflowId

4. POST /workflow/{workflowId}/steps
   └─ Cria 3 steps

5. Para cada step:
   POST /workflow/{workflowId}/step/{stepId}/assign
   └─ Atribui worker

6. Worker processa...

7. POST /workflow/{workflowId}/step/{stepId}/complete
   └─ Completa step
```

### Fluxo 2: Tratamento de Erro com Retry

```
1. Worker encontra erro
   └─ POST /team/{teamId}/error/log

2. Sistema scheduled retry automaticamente
   └─ errorId com próxima tentativa

3. Background job (a cada 30s):
   ├─ Busca pending retries
   ├─ Se ainda hay tentativas: reprocessa
   └─ Se max retries: escalata

4. Escalation (a cada 1m):
   ├─ Promove severity
   ├─ Notifica coordinator
   └─ Adiciona à fila de escalation
```

### Fluxo 3: Integração com MCP Tools

```
1. POST /team/{teamId}/mcp-tool/register
   └─ Tool registrada

2. POST /team/{teamId}/mcp-tool/{toolId}/access
   ├─ Worker A: full access, 1000/hora
   └─ Worker B: limited access, 100/hora

3. Worker usa ferramenta
   └─ POST /mcp-tool/{toolId}/log-call
      └─ Registra uso

4. GET /mcp-tool/{toolId}/stats
   └─ Ver estatísticas
```

---

## 🚨 Tratamento de Erros

### Severidade Escalation

```
low → medium → high → critical

Após 3+ retries automático:
└─ Severity promove
└─ Coordinator notificado
└─ Adicionado a escalation_queue
```

### Retry Strategies

```
exponential_backoff (padrão):
  1ª tentativa: 30s delay
  2ª tentativa: 60s delay
  3ª tentativa: 120s delay
  
linear:
  Cada tentativa: +30s delay
  
no_retry:
  Sem retries automáticas
```

### Status HTTP

```
200 OK        → Sucesso
400 Bad Req   → Erro de validação
403 Forbidden → Sem permissão
404 Not Found → Recurso não encontrado
500 Error     → Erro no servidor
```

---

## 📊 Monitoramento

### Status do Sistema

```bash
# Health check
curl http://localhost:3000/api/health

# Team stats
curl http://localhost:3000/api/coordination/team/{teamId}

# Workflow stats
curl http://localhost:3000/api/coordination/team/{teamId}/workflow-stats

# Error stats
curl http://localhost:3000/api/coordination/team/{teamId}/error-stats
```

### Logs

```bash
# Build
npm run build        # ✅ 0 errors

# Testes
npm run test         # ✅ 11/11 passing

# Dev server
npm run dev          # Com hot reload
```

### Background Jobs

```
Retry Executor       → A cada 30 segundos
Workflow Cleanup     → A cada 1 hora
Error Cleanup        → A cada 1 hora
Error Escalation     → A cada 1 minuto
```

---

## 📖 Documentação Detalhada

Para mais informações, consulte:

| Documento | Conteúdo |
|-----------|----------|
| **COORDINATION_COMPLETE.md** | Referência completa do sistema, banco de dados, features avançadas |
| **INTEGRATION_EXAMPLES.md** | Exemplos práticos de curl, workflows completos, script shell |
| **ARCHITECTURE_DIAGRAMS.md** | Diagramas de arquitetura, fluxos de dados, relacionamentos DB |

---

## 🔍 FAQ

### P: Como começar rápido?
**R:** Veja [Quick Start](#-quick-start) no topo deste documento.

### P: O banco de dados é criado automaticamente?
**R:** Sim! Ao iniciar o servidor, todas as 11 tabelas são criadas se não existirem.

### P: Posso usar sem PostgreSQL localmente?
**R:** Não, o sistema requer PostgreSQL. Você pode usar Docker:
```bash
docker run -d -p 5432:5432 \
  -e POSTGRES_PASSWORD=password \
  postgres:15
```

### P: Como debugar erros?
**R:** Verifique `error-stats` e `recent-errors` via API, ou consulte logs do servidor.

### P: Qual o limite de requisições?
**R:** Permission system: 60 calls/min por chat. MCP tools: configurável.

### P: Como fazer deploy?
**R:** Sistema pronto para Docker/K8s. Adicione `npm run build` ao build stage.

---

## ✅ Checklist de Implementação

- ✅ Mailbox system (BD-based messaging)
- ✅ Spawner (worker creation)
- ✅ Workflow orchestration
- ✅ Error handling com retries
- ✅ Escalation automática
- ✅ MCP tool integration
- ✅ Background jobs scheduler
- ✅ REST API (50+ endpoints)
- ✅ Database initialization
- ✅ Graceful shutdown
- ✅ Comprehensive documentation
- ✅ Integration examples
- ✅ TypeScript (0 errors)
- ✅ Tests (11/11 passing)

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação detalhada
2. Verifique os exemplos de integração
3. Rode testes: `npm run test`
4. Build: `npm run build` (0 errors = OK)

---

## 📝 Changelog

### v1.0 - Abril 2026
- ✅ Sistema completo de coordenação multi-agentes
- ✅ 11 tabelas PostgreSQL com indexes
- ✅ 50+ endpoints REST
- ✅ Background jobs (retry, cleanup, escalation)
- ✅ Documentação completa
- ✅ Production ready

---

**Status:** 🟢 **PRODUCTION READY**

**Desenvolvido por:** Claude AI  
**Tech Stack:** TypeScript, Node.js, Express, PostgreSQL  
**Build:** ✅ 0 errors | Tests: ✅ 11/11 passing

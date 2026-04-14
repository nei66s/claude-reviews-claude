# Coordination System (Multi-Agent)

Implementação de um sistema de coordenação multi-agent para o Chocks. Permite que um agent maestro (Coordinator) despache workers especializados para executar tarefas em paralelo.

## 📋 Arquitetura

```
Coordinator (Agent Principal)
    ↓ spawns workers
    ├→ Worker 1 (role: 'researcher')  — pesquisa, analisa contexto
    ├→ Worker 2 (role: 'implementer') — executa mudanças (files, bash)
    └→ Worker 3 (role: 'tester')      — valida resultados

Comunicação via Mailbox (BD)
    ├ Direct messages (worker → coordinator)
    ├ Broadcasts (coordinator → all workers)
    ├ Notifications (idle, error, permission requests)
    └ Task assignments
```

## 🛠️ Componentes

### 1. **Mailbox System** (`src/coordination/mailbox.ts`)

Sistema de caixa de mensagens baseado em BD (PostgreSQL). Substitui arquivo-mailbox do Claude Code com BD para melhor escalabilidade.

**Tabelas:**
- `coordination_teams` — Metadados do time
- `coordination_agents` — Membros do time (leader + workers)
- `coordination_messages` — Histórico de mensagens

**Message Types:**
- `direct_message` — DM privado
- `broadcast` — Para todos os agentes
- `task_notification` — Tarefa atribuída
- `idle_notification` — Worker completou/bloqueou
- `permission_request` — Worker pede aprovação
- `permission_response` — Coordinator aprova/nega
- `error_notification` — Erro durante execução

**Funções principais:**
```typescript
// Team
createTeam(name, leaderAgentId) → teamId
deleteTeam(teamId) → void
getTeam(teamId) → Team | null

// Agents
registerAgent(teamId, agentId, role) → agentId
updateAgentStatus(teamId, agentId, status) → void
getTeamAgents(teamId) → Agent[]

// Messages
sendMessage(teamId, from, to, type, content, metadata) → messageId
getInbox(teamId, agentId) → Message[]
markAsRead(messageId) → void
getMessageHistory(teamId, from?, to?, limit=100) → Message[]
```

### 2. **Spawner** (`src/coordination/spawner.ts`)

Cria novos workers e gerencia ciclo de vida.

**Funções:**
```typescript
spawnWorker(teamId, coordinatorId, spec) → SpawnedWorker
  spec: { role, goal, context? }

spawnWorkers(teamId, coordinatorId, specs[]) → SpawnedWorker[]

getTeamWorkers(teamId) → Agent[]
```

**Prompt Gerado para Worker:**
- Role e objetivo
- Context isolation (worker NÃO vê conversa do coordinator)
- Instruções claras sobre notificações esperadas
- Todo contexto necessário must be self-contained

### 3. **REST API** (`src/api/coordinationRoutes.ts`)

**Endpoints:**

```bash
# Team Management
POST   /api/coordination/team/create
GET    /api/coordination/team/:teamId
DELETE /api/coordination/team/:teamId

# Agent Management
POST   /api/coordination/team/:teamId/register
GET    /api/coordination/team/:teamId/agents
PATCH  /api/coordination/team/:teamId/agent/:agentId/status

# Worker Spawning
POST   /api/coordination/team/:teamId/spawn

# Messaging
GET    /api/coordination/team/:teamId/inbox/:agentId
POST   /api/coordination/team/:teamId/send
POST   /api/coordination/team/:teamId/message/:messageId/read
GET    /api/coordination/team/:teamId/history
```

## 🚀 Como Usar

### 1. Criar um Team

```bash
curl -X POST http://localhost:3000/api/coordination/team/create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project-team",
    "leaderAgentId": "coordinator@project1",
    "config": {}
  }'

# Response:
# { "success": true, "teamId": "team-1712234567890-abc123" }
```

### 2. Spawnar Workers

```bash
curl -X POST http://localhost:3000/api/coordination/team/team-xxx/spawn \
  -H "Content-Type: application/json" \
  -d '{
    "coordinatorAgentId": "coordinator@project1",
    "role": "researcher",
    "goal": "Analyze the codebase and identify performance bottlenecks",
    "context": {
      "projectPath": "./src",
      "language": "typescript",
      "framework": "react"
    }
  }'

# Response:
# {
#   "success": true,
#   "worker": {
#     "agentId": "researcher-1712234567890-abc123@team-xxx",
#     "teamId": "team-xxx",
#     "role": "researcher",
#     "workerId": "researcher-1712234567890-abc123"
#   }
# }
```

### 3. Enviar Mensagens

```bash
# Coordinator → Worker (direct message)
curl -X POST http://localhost:3000/api/coordination/team/team-xxx/send \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "coordinator@project1",
    "toAgentId": "researcher-xxx@team-xxx",
    "messageType": "direct_message",
    "content": "Please provide a summary of your findings",
    "metadata": {}
  }'

# Coordinator → All (broadcast)
curl -X POST http://localhost:3000/api/coordination/team/team-xxx/send \
  -H "Content-Type: application/json" \
  -d '{
    "fromAgentId": "coordinator@project1",
    "toAgentId": null,
    "messageType": "broadcast",
    "content": "Team standup in 5 minutes - please report status"
  }'
```

### 4. Monitorar Inbox

```bash
curl http://localhost:3000/api/coordination/team/team-xxx/inbox/coordinator@project1

# Response:
# {
#   "messages": [
#     {
#       "id": "msg-xxx",
#       "team_id": "team-xxx",
#       "from_agent_id": "researcher-xxx@team-xxx",
#       "to_agent_id": "coordinator@project1",
#       "message_type": "idle_notification",
#       "content": "Research completed. Found 3 bottlenecks.",
#       "metadata": { "bottlenecks": [...] },
#       "read": false,
#       "created_at": "2024-04-13T03:45:00Z"
#     }
#   ],
#   "count": 1
# }
```

### 5. Marcar Como Lido

```bash
curl -X POST http://localhost:3000/api/coordination/team/team-xxx/message/msg-xxx/read
```

## 📊 Exemplo Completo: Workflow

### Scenario: Coordinator atribui 3 tarefas em paralelo

**Passo 1:** Criar team
```bash
POST /api/coordination/team/create
```

**Passo 2:** Spawnar 3 workers
```bash
POST /api/coordination/team/{teamId}/spawn # researcher
POST /api/coordination/team/{teamId}/spawn # implementer
POST /api/coordination/team/{teamId}/spawn # tester
```

**Passo 3:** Cada worker recebe prompt self-contained
```
You are a [role] in a coordination team.
Goal: [goal]
Context: [context]

When done, send idle_notification with status "completed"
```

**Passo 4:** Coordinator poll inbox
```bash
GET /api/coordination/team/{teamId}/inbox/coordinator@project1
```

**Passo 5:** Workers enviam notificações
```bash
POST /api/coordination/team/{teamId}/send
{
  "fromAgentId": "researcher-xxx@team-xxx",
  "toAgentId": "coordinator@project1",
  "messageType": "idle_notification",
  "content": "Task completed",
  "metadata": { "status": "completed", "results": [...] }
}
```

**Passo 6:** Coordinator lê resultados e sincroniza
- Se todos completaram → proceeds
- Se algum foi blockeado → solicita permissão/escalda
- Se erro → retry ou abort

## 🧪 Testes

Testes estão em [test.coordination.ts](../tests/test.coordination.ts) e marcados como `.skip` por padrão (requerem BD).

Para rodar com DB:
```bash
# 1. Inicie PostgreSQL
# 2. Setup DATABASE_URL em .env
# 3. Remova `.skip` em test.coordination.ts
npm run test
```

Resultado esperado: **17/17 tests passing**

## 🔌 Integração com Existing Systems

### Com Permission Pipeline
Workers pedem aprovação via `permission_request`:
```typescript
await sendMessage(teamId, workerId, coordinatorId, 'permission_request', 
  'Need bash_exec approval', 
  { toolName: 'bash_exec', command: 'npm test' })

// Coordinator approves:
await sendMessage(teamId, coordinatorId, workerId, 'permission_response',
  'Permission granted',
  { toolName: 'bash_exec', approved: true })
```

### Com Audit System
Todas as mensagens de coordination são auditadas automaticamente via tabela `coordination_messages`

### Com Cost Tracking
Cada worker tem seu próprio LLM budget (futuro)

## 📝 Next Steps

1. **Worker Task Engine** — Interpretar prompts do coordinator
2. **Result Aggregation** — Sintetizar outputs de múltiplos workers
3. **Retry Logic** — Reespawnar workers se falharem
4. **Performance Metrics** — Track tempo/custo por worker
5. **UI Dashboard** — Visualizar team status em tempo real

## 📚 Referência

- **Architecture**: [03-coordinator.md](../../architecture/03-coordinator.md)
- **Swarms**: [08-agent-swarms.md](../../architecture/08-agent-swarms.md)
- **Permissions**: [agent-ts/src/permissions/](../src/permissions/)

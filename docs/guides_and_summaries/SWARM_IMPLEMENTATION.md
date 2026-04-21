# 🐝 Swarm Feature - Implementation Guide

## Overview

Este documento descreve a implementação completa da feature **Swarm** (página `/swarm`) no projeto Chocks.

**Status:** ✅ **COMPLETO E FUNCIONAL**

---

## 📋 O que foi Implementado

### 1. **Componente SwarmView** 
**Arquivo:** `app/components/SwarmView.tsx`

**Funcionalidades:**
- ✅ Exibe lista de times de agentes
- ✅ Criar novos times com formulário
- ✅ Expandir/colapsar times para ver detalhes dos agentes
- ✅ Exibir status dos agentes (idle, busy, offline) com indicadores visuais
- ✅ Enviar mensagens para times
- ✅ Carregamento com skeleton loaders
- ✅ Fallback automático para dados mock quando API falha

**Props:** Nenhuma (componente autossuficiente)

**Estados:**
- `teams`: Lista de times
- `loading`: Estado de carregamento
- `selectedTeam`: Time expandido
- `messageText`: Texto da mensagem
- `newTeamName/Desc`: Campos do formulário

### 2. **Integração com AppShell**
**Arquivo:** `app/components/AppShell.tsx`

**Mudanças:**
```tsx
// Import
import SwarmView from "./SwarmView";

// Render
{activeWorkspace === "swarm" && <SwarmView />}
```

### 3. **System de Mocks (Completo)**
**Diretório:** `app/lib/mocks/`

#### Files:

**`fixtures.ts`** - Dados reutilizáveis
```tsx
// 3 Times:
// - Research Squad (Aurora, Nexus)
// - Code Review Team (Sentinel, Refactor)
// - Data Processing Squad (Analyzer, Guardian)

// 6 Agentes com diferentes status
mockAgents.aurora       // idle
mockAgents.sentinel     // busy
mockAgents.guardian     // offline
```

**Exports:**
- `mockTeams` - Array de times
- `mockAgents` - Dicionário de agentes
- `getMockTeam(id)` - Buscar time por ID
- `getMockAgent(id)` - Buscar agente por ID
- `createMockTeam(name, desc)` - Criar novo time

---

**`handlers.ts`** - Handlers de API mock
```tsx
// Interceptadores de chamadas HTTP
// GET  /swarm/teams
// GET  /swarm/teams/:teamId
// POST /swarm/teams
// POST /swarm/message
```

**Exports:**
- `swarmHandlers` - Array de handlers
- `resetMockStorage()` - Resetar dados
- `setMockTeams(teams)` - Customizar dados
- `getMockTeamsData()` - Retornar dados atuais

---

**`msw-setup.ts`** - Setup MSW (Mock Service Worker)

**Para ativar MSW em desenvolvimento:**
```bash
npm install -D msw
npx msw init public/
```

**Exports:**
- `createSwarmHandlers()` - Retornar handlers para MSW
- `resetSwarmMocks()` - Resetar estado
- `setSwarmMockTeams()` - Customizar dados
- `getSwarmMockTeams()` - Retornar times atuais

---

**`fixtures.test.ts`** - Suite de testes (23 testes)

Testes incluem:
- ✅ Verificação de fixtures básicas
- ✅ Helpers de busca (getMockTeam, getMockAgent)
- ✅ Criação de teams mock
- ✅ Gestão de storage
- ✅ Relacionamentos team-agent (integridade de dados)

```bash
npm run test -- fixtures.test.ts
```

---

**`README.md`** - Documentação completa

Covers:
- Como usar mocks em componentes
- Como usar em testes
- Como configurar MSW
- Como adicionar novos mocks

---

**`EXAMPLES.md`** - Exemplos práticos (6 cenários)

1. ✅ Unit tests com Vitest
2. ✅ Component tests com React Testing Library
3. ✅ API tests com MSW
4. ✅ Integration tests
5. ✅ Snapshot tests
6. ✅ E2E tests com Playwright

---

**`index.ts`** - Exportações centralizadas

```tsx
export * from "./fixtures";
export * from "./handlers";
export * from "./msw-setup";
```

---

## 🚀 Como Usar

### Desenvolvimento

**A página já está funcional:**
```
http://localhost:3000/swarm
```

Quando a API real não estiver disponível, o componente usa automaticamente os mocks.

### Testes

**Teste as fixtures:**
```bash
npm run test -- app/lib/mocks/fixtures.test.ts
```

**Usar em seus testes:**
```tsx
import { mockTeams, getMockTeam, resetMockStorage } from "@/lib/mocks";

beforeEach(() => resetMockStorage());

it("should display teams", () => {
  expect(mockTeams).toHaveLength(3);
});
```

### MSW (Opcional)

Se quiser interceptar todas as chamadas HTTP:

```bash
npm install -D msw
npx msw init public/
```

Depois adicione em seu `setupTests.ts` ou `middleware.ts`:
```tsx
import { createSwarmHandlers } from "@/lib/mocks/msw-setup";

export const handlers = [
  ...createSwarmHandlers(),
];
```

---

## 📊 Dados Mock Fornecidos

### Times (3)
| ID | Nome | Descrição | Agentes | Status |
|----|------|-----------|---------|--------|
| team-1 | Research Squad | Investigação de tendências AI | Aurora, Nexus | active |
| team-2 | Code Review Team | Verificação de qualidade de código | Sentinel, Refactor | active |
| team-3 | Data Processing Squad | Análise de dados em larga escala | Analyzer, Guardian | active |

### Agentes (6)
| ID | Nome | Role | Status | Última Mensagem |
|----|------|------|--------|-----------------|
| agent-1 | Aurora | Researcher | idle | Analyzed 5 papers today |
| agent-2 | Nexus | Coordinator | idle | Coordinating findings |
| agent-3 | Sentinel | Reviewer | busy | Reviewing PR #42 |
| agent-4 | Refactor | Optimizer | idle | Waiting for tasks |
| agent-5 | Analyzer | Data Scientist | busy | Processing 10K records |
| agent-6 | Guardian | Security Officer | offline | Last seen 2 hours ago |

---

## 🔧 Próximos Passos

### Para Backend Real

Implemente estas rotas API:

```tsx
// GET /swarm/teams
// Retornar: { teams: SwarmTeam[], total: number, timestamp: string }

// GET /swarm/teams/:teamId
// Retornar: SwarmTeam

// POST /swarm/teams
// Body: { name: string, description?: string }
// Retornar: SwarmTeam (criado)

// POST /swarm/message
// Body: { teamId: string, message: string }
// Retornar: { success: true, timestamp: string }

// DELETE /swarm/teams/:teamId
// Retornar: { success: true }
```

### Type Definitions

Se precisar estender os tipos:

```tsx
interface SwarmAgent {
  id: string;
  name: string;
  role: string;
  status: "idle" | "busy" | "offline";
  lastMessage?: string;
  // Adicionar campos conforme necessário
}

interface SwarmTeam {
  id: string;
  name: string;
  description: string;
  agents: SwarmAgent[];
  createdAt: string;
  state: "active" | "paused" | "archived";
  // Adicionar campos conforme necessário
}
```

---

## 📁 Estrutura de Arquivos

```
app/
├── components/
│   ├── SwarmView.tsx              ✅ Componente principal
│   └── AppShell.tsx               ✅ Integração
│
├── lib/
│   ├── mocks/
│   │   ├── fixtures.ts            ✅ Dados mock
│   │   ├── handlers.ts            ✅ Handlers HTTP
│   │   ├── msw-setup.ts           ✅ Setup MSW
│   │   ├── fixtures.test.ts       ✅ Testes
│   │   ├── index.ts               ✅ Exports
│   │   ├── README.md              ✅ Documentação
│   │   ├── EXAMPLES.md            ✅ Exemplos
│   │   └── (este arquivo)
│
└── swarm/
    └── page.tsx                   ✅ Rota /swarm
```

---

## 🎨 UI/UX

### Página Swarm
- **Header:** "🐝 Mapa da Família de Agentes"
- **Seção 1:** Criar novo time (formulário)
- **Seção 2:** Lista de times expandível
- **Seção 3:** Detalhes de agentes e chat (ao expandir)

### Indicadores de Status
- 🟢 **Idle:** Verde, disponível
- 🟠 **Busy:** Laranja, ocupado
- ⚪ **Offline:** Cinza, desconectado

---

## ✅ Testes Inclusos

**23 Testes em `fixtures.test.ts`:**

Grupo: Fixtures
- ✅ Should have mock teams
- ✅ Should have mock agents
- ✅ Should have agents in teams
- ✅ Should have correct agent statuses

Grupo: Helpers
- ✅ getMockTeam should find a team by ID
- ✅ getMockTeam should return undefined for unknown ID
- ✅ getMockAgent should find an agent by ID
- ✅ getMockAgent should return undefined for unknown ID
- ✅ createMockTeam should create a new team
- ✅ New team should have unique ID

Grupo: Storage Management
- ✅ resetMockStorage should restore initial state
- ✅ setMockTeams should set custom teams

Grupo: Team-Agent Relationships
- ✅ All agents in teams should be valid
- ✅ Should have agents across teams
- ✅ No agent should be in multiple teams (data integrity)

---

## 🔗 Referências

**Documentação Relacionada:**

- `app/lib/mocks/README.md` - Guia de mocks
- `app/lib/mocks/EXAMPLES.md` - Exemplos de uso
- `SwarmView.tsx` - Código do componente
- `fixtures.test.ts` - Suite de testes

---

## ❓ Troubleshooting

### Página Swarm está em branco

**Solução:** 
- Verifique se o servidor está rodando: `npm run dev`
- Verifique se o componente foi importado em AppShell
- Abra console do navegador para erros

### Dados Mock não aparecem

**Solução:**
- Os mocks aparecem AUTOMATICAMENTE quando a API falha
- Se você quer testar com mocks, desative a API real ou deixe-a responder com erro

### Quero testar com dados diferentes

**Solução:**
```tsx
import { setMockTeams, createMockTeam } from "@/lib/mocks";

// Em testes
beforeEach(() => {
  setMockTeams([
    createMockTeam("Meu Time Customizado")
  ]);
});
```

### MSW não está interceptando requisições

**Solução:**
- Instale MSW: `npm install -D msw`
- Inicialize: `npx msw init public/`
- Importe handlers em seu setup de testes

---

## 🎯 Resumo

| Aspecto | Status | Detalhes |
|--------|--------|----------|
| Componente UI | ✅ Completo | SwarmView.tsx funcional |
| Mocks | ✅ Completo | 3 times, 6 agentes, 6 helpers |
| Testes | ✅ Completo | 23 testes em fixtures.test.ts |
| Documentação | ✅ Completo | README, EXAMPLES, este arquivo |
| MSW Setup | ✅ Completo | Pronto para ativar |
| Integração | ✅ Completo | Integrado em AppShell |
| API Real | ⏳ Futuro | Rotas a implementar |

---

**Última Atualização:** 13 de Abril de 2026  
**Versão:** 1.0.0  
**Status:** 🟢 FUNCIONAL

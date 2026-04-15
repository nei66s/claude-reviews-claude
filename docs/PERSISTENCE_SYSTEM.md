# 🗄️ Sistema Completo de Persistência de Conversas

## 📋 O Que É Persistido

Tudo agora fica salvo no banco quando a conversa acontece:

### ✅ Dados de API & Contexto
- **Cotações de câmbio** (USD, EUR, etc) - com histórico de consultas
- **Respostas de APIs** - cache intelligente que recupera sem repetir chamadas
- **Metadados da conversa** - preferências, fatos importantes

### ✅ Rastreamento de Agentes
| O que | Onde fica | Propósito |
|------|----------|----------|
| **Quem respondeu** | `agent_response_history` | Saber que Kitty respondeu a pergunta sobre dólar |
| **Quem suportou** | `agent_support_chain` | Betinha validou a resposta de Kitty com dados financeiros |
| **Interações** | `agent_interaction_graph` | Histórico de quem questiona, corrige, valida quem |
| **Estado de agente** | `agent_conversational_state` | Personalidade, confiança, humor, decisões recentes |

### ✅ Mensagens & Traces
- **Historico completo** de quem respondeu cada mensagem
- **Cadeia de suporte** - quem apoiou com que dados
- **Tool calls** - quais ferramentas foram usadas
- **Performance metrics** - latência, tokens, custos

---

## 🧩 Persistência de Identidade do Agente (UI pós-reload)

Para que o frontend mostre **o agente certo (nome/foto)** e também o **apoio (2 agentes)** mesmo após `reload/reset`, a identidade do atendente é persistida **por mensagem** na tabela `public.messages`.

### Campos usados
- `public.messages.agent_id` — agente primário que respondeu (ex.: `kitty`, `betinha`, `chocks`)
- `public.messages.helper_agent_id` — agente de apoio (opcional)
- `public.messages.handoff_label` — banner “X assumiu a conversa” (opcional)
- `public.messages.collaboration_label` — banner “X chamou Y para ajudar” (opcional)
- `public.messages.trace_json` — trace persistido (ex.: para reidratar `SOURCES` após reload)

### Migração (Postgres)
Execute **uma vez** como `postgres` (ou usuário com permissão de `ALTER TABLE`):

```sql
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS agent_id TEXT,
  ADD COLUMN IF NOT EXISTS helper_agent_id TEXT,
  ADD COLUMN IF NOT EXISTS handoff_label TEXT,
  ADD COLUMN IF NOT EXISTS collaboration_label TEXT;
```

Se a aplicação estiver com erro de permissão (“must be owner of table”), ajuste ownership:

```sql
ALTER TABLE public.messages OWNER TO chocks_user;
ALTER SEQUENCE public.messages_id_seq OWNER TO chocks_user;
```

### Notas de implementação
- O backend grava `agent_id/helper_agent_id` quando persiste a resposta do stream.
- O backend também persiste `trace_json` (JSONB). Para evitar erro de tipo JSON no Postgres, serialize o trace como JSON (ex.: `JSON.stringify(trace)` no Node).
- O frontend renderiza avatars/badges com base em `message.agentId` e `message.helperAgentId`, e reidrata o bloco `SOURCES` a partir do `trace`.

## 🔧 Como Usar

### 1. Registrar Quem Respondeu

```typescript
import { recordAgentResponse } from '@/agent-ts/src/persistence'

// Quando Kitty responde uma pergunta
await recordAgentResponse(
  messageId,           // ID da mensagem
  conversationId,      // ID da conversa
  userId,              // ID do usuário
  'kitty',             // Quem respondeu
  'model',             // Papel do agente
  'direct',            // Tipo de resposta (direct|follow_up|correction|support|clarification)
  true,                // É respondedor primário?
  0.95,                // Confiança (0-1)
  { sourceData: {...} } // Dados da resposta
)
```

### 2. Registrar Quem Suportou

```typescript
import { recordAgentSupport } from '@/agent-ts/src/persistence'

// Quando Betinha suporta Kitty com dados de câmbio
await recordAgentSupport(
  conversationId,
  userId,
  messageId,           // ID da mensagem de Kitty
  'kitty',             // Agente que respondeu
  'betinha',           // Agente que suportou
  'data_source',       // Tipo de suporte (validation|data_source|correction|clarification|backup|expertise)
  'Taxa USD confirmada com dados de 2026-04-14', // Conteúdo do suporte
  { rate: 5.12, timestamp: '...' },  // Dados de suporte
  'like'               // Feedback (like|dislike|neutral|improved|corrected)
)
```

### 3. Rastrear Interações Entre Agentes

```typescript
import { recordAgentInteraction } from '@/agent-ts/src/persistence'

// Quando um agente questiona outro
await recordAgentInteraction(
  conversationId,
  userId,
  'bento',             // De (quem questiona)
  'kitty',             // Para (quem é questionado)
  'questions',         // Tipo (supports|corrects|validates|questions|builds_on|disagrees|clarifies|provides_data)
  12,                  // Índice da mensagem
  'Bento questionou a confiabilidade da fonte' // Contexto
)
```

### 4. Persistir Cotação de Câmbio

```typescript
import { cacheApiCall } from '@/agent-ts/src/persistence'

// Salvar cotação para que não repita
await cacheApiCall(
  conversationId,
  userId,
  'exchange_rate',     // API name
  '/v4/latest/USD',    // Endpoint
  { from: 'USD', to: 'BRL' },  // Request params
  { rate: 5.12, ask: 5.13, bid: 5.11 }, // Response
  'betinha',           // Qual agente buscou
  200,                 // Status code
  undefined,           // Error message
  24 * 60 * 60 * 1000  // Expira em 24h
)
```

### 5. Manter Estado do Agente na Conversa

```typescript
import { updateAgentConversationalState } from '@/agent-ts/src/persistence'

// Atualizar estado de Kitty durante conversa
await updateAgentConversationalState(
  conversationId,
  userId,
  'kitty',
  {
    agentRole: 'model',
    agentEmoji: '🐱',
    isActive: true,
    lastMessageIndex: 5,
    personalityState: {
      mood: 'confident',
      recentThoughts: ['exchange rates are stable', 'betinha confirmed data']
    },
    expertiseContext: {
      expertise: ['design', 'communication'],
      recentDecisions: ['used visual approach']
    },
    confidenceScore: 0.92,
    moodIndicator: 'curious',
    supportProvidedCount: 2,
    correctionsMade: 1
  }
)
```

### 6. Recuperar Tudo Da Conversa

```typescript
import { loadFullConversationContext } from '@/agent-ts/src/persistence'

// Quando usuário volta à conversa
const fullContext = await loadFullConversationContext(conversationId)

// Contém:
// - metadata: último agente acessado, sequência, preferências
// - agentStates: estado de cada agente (Kitty, Betinha, etc)
// - agentInteractions: grafo de interações (quem questiona quem, etc)
// - supportSummary: resumo de quem apoiou quem
// - context: cotações, preferências, respostas de API cached
```

### 7. Ver Resumo da Conversa

```typescript
import { getConversationDynamicsSummary } from '@/agent-ts/src/persistence'

const summary = await getConversationDynamicsSummary(conversationId)

// Retorna:
// {
//   metadata: { ... },
//   agents: [ { agentName: 'kitty', ... }, { agentName: 'betinha', ... } ],
//   interactions: [ { fromAgent: 'bento', toAgent: 'kitty', interactionType: 'questions', ... } ],
//   supportMap: [ { primary_agent: 'kitty', supporting_agent: 'betinha', support_type: 'data_source' } ],
//   statistics: {
//     totalAgentsInvolved: 3,
//     totalInteractions: 12,
//     primaryInteractionType: 'supports',
//     agentMostActive: 'betinha'
//   }
// }
```

---

## 📊 Tabelas Criadas

```
conversation_context          - Dados de contexto com TTL
api_calls_cache              - Cache de APIs com expiração
agent_response_history       - Quem respondeu cada mensagem
agent_support_chain          - Cadeia de suporte entre agentes
agent_conversational_state   - Estado conversacional de cada agente
agent_interaction_graph      - Rede de interações entre agentes
message_traces               - Traces de ferramentas/reasoning
conversation_metadata        - Metadados agregados da conversa
```

---

## 🔄 Fluxo de Recuperação

Quando usuário volta à conversa:

1. **Carregar metadados** → Sabe qual agente era ativo
2. **Carregar estado de agentes** → Cada um retoma de onde parou
3. **Recuperar interações** → Relacionamento entre agentes preservado
4. **Carregar dados em cache** → Cotações, APIs, não repete chamadas
5. **Restaurar contexto completo** → Tudo pronto para continuar

---

## ✨ Exemplos Reais

### Cenário: Pergunta sobre dólar

```
User: "Qual é o valor do dólar?"

1. Kitty responde: "Deixa eu verificar pra você!"
   → recordAgentResponse('kitty', 'direct')

2. Betinha valida: "A taxa está confirmada em 5.12"
   → recordAgentSupport('kitty', 'betinha', 'data_source', 'taxa confirmada...')

3. Cotação é salva
   → cacheApiCall('exchange_rate', { from: 'USD' }, { rate: 5.12 })

4. Interação é registrada
   → recordAgentInteraction('betinha', 'kitty', 'supports')

User fecha conversa.
User volta depois.

5. Sistema carrega tudo:
   → loadFullConversationContext()
   → Sabe que Kitty respondeu com suporte de Betinha
   → Não refaz a chamada da API (está em cache)
   → Continua de onde parou!
```

---

## 🎯 Próximas Etapas

1. Integrar ao `chat-tools.ts` chamadas de persistência
2. Chamar `recordAgentResponse` quando um agente responde
3. Chamar `recordAgentSupport` quando há suporte
4. Chamar `recordAgentInteraction` após cada mensagem
5. Mostrar contexto recuperado na UI quando conversa abre

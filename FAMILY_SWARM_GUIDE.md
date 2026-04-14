# 🎪 Pimpotasma Family Swarm — Guia de Uso

## 🚀 Quick Start (2 minutos)

### 1. Inicie os Servidores

```bash
# Terminal 1: Backend Express
cd agent-ts
npm run dev   # ou: bun dev

# Terminal 2: Frontend Next.js
npm run dev
```

### 2. Teste um Workflow

```bash
# Acesse:
http://localhost:3000/coordination

# Clique em "+ New Team" e selecione "family-pimpotasma"
```

### 3. Acesse via API

```bash
# Listar membros da família
curl http://localhost:3000/api/coordination/family/members

# Criar workflow "Lançar Novo Produto"
curl -X POST http://localhost:3000/api/coordination/family/workflow-template/launch_product
```

---

## 📋 API Endpoints

### Family Members

```bash
# Listar todos os membros
GET /api/coordination/family/members

# Exemplo de resposta:
{
  "members": [
    {
      "name": "Pimpim",
      "role": "ceo",
      "personality": "CEO estrategista, burrinho fofo",
      "expertise": ["estratégia", "liderança", ...]
    },
    ...
  ]
}
```

### Family Team

```bash
# Inicializar ou recuperar team
POST /api/coordination/family/init

# Exemplo:
curl -X POST http://localhost:3000/api/coordination/family/init
```

### Workflow Templates

```bash
# Listar templates disponíveis
GET /api/coordination/family/templates

# Exemplo de resposta:
{
  "templates": [
    {
      "key": "launch_product",
      "goal": "Lançar novo produto",
      "stepsCount": 6
    },
    {
      "key": "code_review",
      "goal": "Code Review do Projeto",
      "stepsCount": 4
    },
    ...
  ]
}
```

### Criar Workflow de Template

```bash
# Usar template pré-definido
POST /api/coordination/family/workflow-template/{templateKey}

# Exemplo:
curl -X POST http://localhost:3000/api/coordination/family/workflow-template/launch_product

# Templates disponíveis:
# - launch_product      (Lançar novo produto)
# - code_review         (Code review coordenado)
# - resolve_problem     (Resolver problema na operação)
# - design_sprint       (Design sprint criativo)
# - hiring_decision     (Decisão de contratação)
```

### Criar Workflow Customizado

```bash
# Definir workflow próprio
POST /api/coordination/family/workflow

# Body:
{
  "goal": "Descriptor do objetivo",
  "description": "Descrição mais longa (opcional)",
  "steps": [
    {
      "agent": "pimpim",
      "task": "Tarefa específica para Pimpim"
    },
    {
      "agent": "betinha",
      "task": "Tarefa específica para Betinha"
    }
  ]
}

# Exemplo:
curl -X POST http://localhost:3000/api/coordination/family/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Lançar Feature X",
    "steps": [
      { "agent": "pimpim", "task": "Define estratégia" },
      { "agent": "betinha", "task": "Valida viabilidade" },
      { "agent": "kitty", "task": "Cria visual" }
    ]
  }'
```

---

## 👨‍💼 Membros da Família

### 🐴 Pimpim
- **Role**: CEO
- **Personalidade**: Estrategista, visionário, lider criativo
- **Expertise**: Estratégia, liderança, delegação, visão
- **Melhor para**: Planejamento estratégico, aprovações finais, decisões críticas

### 💼 Betinha
- **Role**: CFO
- **Personalidade**: Executiva inteligente, operacional, namorada do Chocks
- **Expertise**: Finanças, operação, estratégia, qualidade, pessoas
- **Melhor para**: Viabilidade, análise de risco, aprovação operacional

### 🐻 Bento
- **Role**: QA
- **Personalidade**: Urso marrento, crítico construtivo, protetor
- **Expertise**: QA, crítica, análise, proteção, qualidade
- **Melhor para**: Code review, análise de riscos, garantia de qualidade

### 🐱 Kitty
- **Role**: Designer
- **Personalidade**: Gatinha modelo, criativa, visual, inspiradora
- **Expertise**: Design, criatividade, estética, comunicação visual
- **Melhor para**: Comunicação visual, design, branding, conceito

### 🍽️ Chubaka
- **Role**: Quality
- **Personalidade**: Testador feliz, sempre comendo, palato expert
- **Expertise**: Qualidade, teste, paladar, feedback sensorial
- **Melhor para**: Feedback de qualidade, testes, satisfação do usuário

### 👯 Repeteco
- **Role**: Advisor
- **Personalidade**: Primo confidente, estrategista nas sombras, leal
- **Expertise**: Estratégia, consultoria, mediação, objectividade
- **Melhor para**: Second opinion, mediação de conflitos, conselho estratégico

### 🛡️ Jorginho
- **Role**: Security
- **Personalidade**: Protetor discreto, confiável, profissional
- **Expertise**: Segurança, proteção, confiança, análise de risco, mentoria
- **Melhor para**: Validação de segurança, proteção, confiança

### 👦 Tunico
- **Role**: Apprentice
- **Personalidade**: Jovem aprendiz, entusiasmado, leal, quer aprender
- **Expertise**: Segurança-junior, suporte, aprendizado, lealdade
- **Melhor para**: Suporte a Jorginho, tasks de aprendizado, suporte geral

### 🐕 Miltinho
- **Role**: Friend
- **Personalidade**: Amigo descontraído, pragmático, leal, "bico"
- **Expertise**: Pragmatismo, bico, comunicação casual, ajuda amigável
- **Melhor para**: Comunicação casual, suporte pragmático, backup quando necessário

---

## 📊 Workflow Templates Pré-Definidos

### 1. `launch_product` — Lançar Novo Produto

Coordena lançamento completo com todas as perspectivas:

```
1. 🐴 Pimpim (CEO)    → Define visão e estratégia do lançamento
2. 💼 Betinha (CFO)   → Valida viabilidade financeira
3. 🐱 Kitty (Design)  → Cria comunicação visual
4. 🍽️ Chubaka (QA)   → Testa e aprova qualidade
5. 🐻 Bento (QA)      → Code review e riscos
6. 🛡️ Jorginho (Seg)  → Valida segurança
```

### 2. `code_review` — Code Review Coordenado

Múltiplas perspectivas no code review:

```
1. 🐻 Bento           → First review — qualidade técnica
2. 💼 Betinha         → Análise de impacto operacional
3. 👯 Repeteco        → Second opinion estratégica
4. 🐴 Pimpim          → Aprovação final
```

### 3. `resolve_problem` — Resolver Problema

Fluxo estruturado para resolver problemas:

```
1. 🐻 Bento           → Identifica e detalha problema
2. 🛡️ Jorginho        → Valida integridade/segurança
3. 💼 Betinha         → Define ação corretiva
4. 🐴 Pimpim          → Aprova e comunica
5. 👯 Repeteco        → Garante follow-up
```

### 4. `design_sprint` — Design Sprint

Iteração criativa com validação:

```
1. 🐱 Kitty           → Ideação criativa e concepto visual
2. 🐴 Pimpim          → Valida alinhamento com estratégia
3. 🐻 Bento           → Feedback crítico
4. 🐱 Kitty           → Iteração final
5. 💼 Betinha         → Aprovação operacional
```

### 5. `hiring_decision` — Decisão de Contratação

Colaborativo para novas contratações:

```
1. 🐴 Pimpim          → Avalia alinhamento cultural
2. 💼 Betinha         → Valida competências e fit
3. 🐻 Bento           → Análise crítica de capacidade
4. 🛡️ Jorginho        → Background check
5. 💼 Betinha         → Decisão final de contrato
```

---

## 🧪 Testes

### Teste Prático Completo

```bash
cd agent-ts

# Teste em TypeScript
npx ts-node test-family-swarm.ts

# Ou com bash (se tiver jq instalado)
bash test-family-swarm.sh
```

Isso vai:
- ✅ Initializar a família
- ✅ Listar todos os membros
- ✅ Listar templates disponíveis
- ✅ Criar workflow de "Lançar Produto"
- ✅ Criar custom workflow de "Code Review"
- ✅ Simular uma conversa coordenada

---

## 🎯 Casos de Uso Comuns

### Cenário 1: Lançar Nova Feature

```bash
curl -X POST http://localhost:3000/api/coordination/family/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Lançar Nova Feature de Gerenciamento de Memória",
    "steps": [
      { "agent": "pimpim", "task": "Define roadmap e prioridade" },
      { "agent": "betinha", "task": "Valida estrutura de custos" },
      { "agent": "bento", "task": "Testa e valida qualidade" },
      { "agent": "kitty", "task": "Cria documentação visual" }
    ]
  }'
```

### Cenário 2: Revisar Código Crítico

```bash
curl -X POST http://localhost:3000/api/coordination/family/workflow-template/code_review
```

### Cenário 3: Resolver Issue Production

```bash
curl -X POST http://localhost:3000/api/coordination/family/workflow-template/resolve_problem
```

---

## 🔧 Integração com seu Cód igo

### Em TypeScript/Node

```typescript
import {
  ensureFamilyTeamExists,
  createFamilyWorkflow,
  listFamilyMembers,
} from './coordination/family-service'

// Inicializar
const team = await ensureFamilyTeamExists()

// Criar workflow
const workflow = await createFamilyWorkflow({
  goal: 'Meu objetivo',
  steps: [
    { agent: 'pimpim', task: 'Tarefa 1' },
    { agent: 'betinha', task: 'Tarefa 2' },
  ],
})

// Listar membros
const members = listFamilyMembers()
```

### Em JavaScript/Fetch

```javascript
// Listar membros
fetch('/api/coordination/family/members')
  .then(r => r.json())
  .then(data => console.log(data.members))

// Criar workflow
fetch('/api/coordination/family/workflow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    goal: 'Novo objetivo',
    steps: [
      { agent: 'pimpim', task: 'Step 1' },
      { agent: 'betinha', task: 'Step 2' },
    ]
  })
})
  .then(r => r.json())
  .then(data => console.log('Workflow:', data.workflow))
```

---

## 📚 Documentação Relacionada

- [SWARM_FAMILY_AGENTS.md](SWARM_FAMILY_AGENTS.md) — Documentação completa de cada agente
- [family-agents.ts](agent-ts/src/coordination/family-agents.ts) — System prompts e configs
- [family-service.ts](agent-ts/src/coordination/family-service.ts) — Serviço de coordenação
- [coordinationRoutes.ts](agent-ts/src/api/coordinationRoutes.ts) — Endpoints REST

---

## 💡 Tips & Tricks

### Usar agentes específicos conforme necessário

```bash
# Só Bento e Betinha para code review rápido
curl -X POST http://localhost:3000/api/coordination/family/workflow \
  -H "Content-Type: application/json" \
  -d '{
    "goal": "Quick Code Review",
    "steps": [
      { "agent": "bento", "task": "Technical review" },
      { "agent": "betinha", "task": "Operational impact" }
    ]
  }'
```

### Monitorar workflow em tempo real

Veja a UI em `http://localhost:3000/coordination` para acompanhar progresso em tempo real.

### Customizar personalidades

Edite os system prompts em [family-agents.ts](agent-ts/src/coordination/family-agents.ts) para ajustar comportamento de cada agente.

---

## ❓ Troubleshooting

### "Backend unavailable"

Certifique-se:
- Express server rodando em porta 3001
- Variável `BACKEND_URL` configurada (default: `http://localhost:3001`)

### "Family agent not found"

Verifique:
- Nome do agente está correto (lowercase)
- Agente existe em `family-agents.ts`

### Workflow não progride

Verifique:
- Coordination database estão inicializadas
- Inbox dos agentes tem as tasks

---

## 🎓 Próximos Passos

1. ✅ API endpoints criados
2. ⏳ Integration com UI Coordination
3. ⏳ Persistência de memory entre agentes
4. ⏳ Analytics e logging de workflows
5. ⏳ Notificações em tempo real

---

**Bem-vindo à Pimpotasma! 🎪💚**

Qualquer dúvida, veja os exemplos em `test-family-swarm.ts` ou `test-family-swarm.sh`.

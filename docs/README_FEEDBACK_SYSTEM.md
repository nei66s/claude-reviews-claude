# 🎯 Resumo Executivo: Sistema de Feedback com Perfil Psicológico

## O Que Foi Criado

Um **sistema adaptativo** onde o CHOCKS aprende as preferências psicológicas de cada usuário através de feedback (like/dislike) e melhora as respostas futuras automaticamente.

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         CHOCKS APP                               │
└──────────────────┬────────────────────────────────┬──────────────┘
                   │                                │
         ┌─────────┴───────┐          ┌──────────────┴──────────┐
         │                 │          │                         │
    ┌─────────────┐  ┌────────────────────┐      ┌──────────────────┐
    │  User Gets  │  │  User Clicks Like/ │      │  System Builds   │
    │  Response   │  │  Dislike + Feedback│      │  Psychological   │
    │             │  │  Modal             │      │  Profile         │
    └──────┬──────┘  └────────┬───────────┘      └────────┬─────────┘
           │                  │                           │
           │    ┌─────────────┴──────────────────────┐   │
           │    ▼                                     ▼   │
           │  ┌──────────────────────────────────────────┐ 
           │  │  POST /api/chat/feedback                 │
           │  │  - Save feedback to DB                   │
           │  │  - Update psychological profile          │
           │  │  - Return updated profile                │
           │  └──────────────┬───────────────────────────┘
           │                 │
           │     ┌───────────┴─────────┐
           │     ▼                     ▼
        ┌────────────────────┐  ┌──────────────────┐
        │ message_feedback   │  │ user_psych_      │
        │ TABLE              │  │ profiles TABLE   │
        │ - message_id       │  │ - tone           │
        │ - feedback (L/D)   │  │ - depth          │
        │ - feedback_text    │  │ - structure      │
        │ - user_id          │  │ - pace           │
        │ - created_at       │  │ - example_type   │
        │                    │  │ - response_len   │
        │                    │  │ - confidence     │
        └────────────────────┘  │ - stats          │
                                └──────────────────┘
           │
           │ (Próxima pergunta)
           ▼
    ┌──────────────────────────────────┐
    │ POST /api/chat/stream             │
    │ 1. Fetch psychological profile    │
    │ 2. Generate profile prompt        │
    │ 3. Inject into system prompt      │
    │ 4. Call OpenAI with context       │
    └──────────────────────────────────┘
           │
           ├──→ "Usar tom casual"
           ├──→ "Preferir exemplos de código"
           ├──→ "Ser breve"
           ├──→ "Estruturar com bullet points"
           │
           ▼
    ┌──────────────────────────────────┐
    │  Response Personalizada           │
    │  (Adaptada ao perfil do usuário) │
    └──────────────────────────────────┘
```

---

## 📦 Componentes Implementados

### 1. **Tipos de Dados** ✅
- `app/lib/api.ts` - Estendido `Message` com `feedback?` e `id?`
- `app/lib/server/psychological-profile.ts` - Tipos principais

### 2. **Backend** ✅
- `app/lib/server/psychological-profile.ts` - Lógica completa:
  - `saveFeedback()` - Persistir feedback
  - `updatePsychologicalProfile()` - Analisar padrões
  - `getPsychologicalProfile()` - Buscar perfil
  - `generateProfilePrompt()` - Gerar instruções
  - `analyzePatterns()` - Heurística de análise

### 3. **Frontend** ✅
- `app/components/MessageFeedback.tsx` - Componente React
- `app/components/MessageFeedback.module.css` - Estilos
- Integrado em `MessageBubble.tsx`

### 4. **API** ✅
- `POST /api/chat/feedback` - Endpoint para salvar feedback

### 5. **Database** ✅
- Migration SQL para criar tabelas e índices
- 2 tabelas: `message_feedback` + `user_psychological_profiles`

### 6. **Integração** ✅
- `app/api/chat/stream/route.ts` modificado para:
  - Buscar perfil do usuário
  - Injetar preferências no system prompt
  - Passar para `buildInstructions()`

---

## 💡 Como Funciona

### Exemplo Prático: Usuário Prefere "Casual e Breve"

```
USER 1º CICLO:
└─ Pergunta: "Como usar async/await?"
└─ Resposta: "Async/await permite executar código assíncrono de forma síncrona..."
└─ Feedback: DISLIKE "Muito formal e longo"

DATABASE:
└─ message_feedback salvo: {feedback: 'dislike', text: 'Muito formal e longo'}
└─ analyzePatterns() detecta:
   • "Muito formal" → tonalPreference = 'casual'
   • "Muito longo" → responseLength = 'brief'
   • confidenceScore = 0.4

---

USER 2º CICLO (minutos depois):
└─ Pergunta: "E promises?"
└─ profile = getPsychologicalProfile(user)
   └─ {tonalPreference: 'casual', responseLength: 'brief', ...}
└─ buildInstructions() injeta:
   "- Usar tom casual e amigável"
   "- Manter respostas breves e objetivas"
└─ OpenAI API chamada COM CONTEXTO PERSONALIZADO
└─ Resposta: "Bora lá! Promises são como contratos do JavaScript.
   const promise = fetch(url).then(res => res.json()).catch(err => console.error(err))
   Simples assim! 🚀"
└─ User clica: LIKE ✅

---

APÓS 20 RESPOSTAS:
└─ confidenceScore = 0.85 (alta confiança)
└─ Todas as respostas são personalizadas
└─ User satisfação: 85% (17 likes / 20 total)
```

---

## 🧠 Dimensões de Perfil Psicológico

O sistema rastreia **6 dimensões principais**:

| Dimensão | Opções | Exemplo |
|----------|--------|---------|
| **Tonal** | formal ↔ casual ↔ balanced | "Oi Chocks!" vs "Bom dia, senhor" |
| **Profundidade** | simplified ↔ technical ↔ balanced | "ELI5" vs "Whitepaper" |
| **Estrutura** | narrative ↔ list ↔ mixed | Parágrafo vs Bullet points |
| **Ritmo** | fast ↔ detailed ↔ balanced | TL;DR vs Full explanation |
| **Exemplos** | code ↔ conceptual ↔ mixed | Python code vs Teoria |
| **Tamanho** | brief ↔ comprehensive ↔ balanced | 1 linha vs 5 parágrafos |

---

## 📊 Análise de Confiança

```
Total de Feedbacks → Confidence Score
1-3 feedbacks      → 0.0 - 0.3  (Muito baixa)   ❌ Não injeta
4-8 feedbacks      → 0.3 - 0.5  (Baixa)        ⚠️  Começa a injetar
9-15 feedbacks     → 0.5 - 0.7  (Média)        ✅ Injeta com confiança
16+ feedbacks      → 0.7 - 1.0  (Alta)         🎯 Muito personalizado
```

---

## 🔄 Fluxo Completo de Dados

```
┌─────────────────────────────────────────────────────────────────┐
│                                                                   │
│  USER ENVIAS PERGUNTA                                             │
│  └─ "Como usar fetch em JavaScript?"                             │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  POST /api/chat/stream/:                                          │
│  ├─ psychProfile = await getPsychologicalProfile(user.id)         │
│  ├─ instructions = buildInstructions(..., psychProfile)           │
│  │  └─ Se psychProfile exists + confidence > 0.3:                 │
│  │     └─ Injeta section: "## PREFERÊNCIAS DO USUÁRIO"           │
│  ├─ Call OpenAI com instructions + history + system context      │
│  └─ Stream response                                               │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  CHOCKS RESPONDE (Personalizado!)                                │
│  └─ "Bora usar fetch! Veja este código:"                         │
│     fetch(url)                                                    │
│     .then(res => res.json())                                      │
│     .catch(err => console.log(err))                               │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  MessageBubble renderiza resposta + BOTÕES DE FEEDBACK            │
│  ├─ [👍 Cuki]                                                     │
│  └─ [👎 Não curti]                                                │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  USER CLICA "NÃO CURTI"                                            │
│  └─ Modal aparece: "Por que você não gostou?"                     │
│     └─ User digita: "Poderia ser ainda mais breve"               │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  POST /api/chat/feedback/                                         │
│  ├─ saveFeedback(user, messageId, 'dislike', 'Poderia ser...')   │
│  ├─ INSERT em message_feedback                                    │
│  ├─ updatePsychologicalProfile(user)                              │
│  │  ├─ Analisa últimos 50 feedbacks                               │
│  │  ├─ analyzePatterns() detecta: "breve" → responseLength=brief │
│  │  └─ UPDATE user_psychological_profiles com novas preferências  │
│  └─ Retorna profile atualizado                                    │
│                                                                   │
│      ↓                                                             │
│                                                                   │
│  PRÓXIMA PERGUNTA:                                                 │
│  └─ Mesmo ciclo, mas agora COM o novo perfil (ainda mais breve)  │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Stack Técnico

- **Frontend**: React + TypeScript + CSS Modules
- **Backend**: Next.js Route Handlers + PostgreSQL
- **AI**: OpenAI Responses API (com system prompts personalizados)
- **BD**: PostgreSQL com tabelas `message_feedback` + `user_psychological_profiles`
- **Análise**: Heurística em TypeScript (pode ser integrada com OpenAI depois)

---

## 📈 Casos de Uso

### Caso 1: Dev Técnico
```
DEV: "Eu quero entender a arquitetura completa"
ANÁLISE: depth=technical, structure=list, exampleType=code, responseLength=comprehensive
CHOCKS: [Resposta com diagrama ASCII, código exemplo, explicação técnica]
RETORNO: ✅ LIKE
```

### Caso 2: CEO Ocupado
```
CEO: "Qual é o status do projeto?"
ANÁLISE: pace=fast, responseLength=brief, tonal=formal, structure=list
CHOCKS: "✅ Status: On track
- Frontend: 80%
- Backend: 90%
- Deploy: Semana que vem
Precisa de detalhes?"
RETORNO: ✅ LIKE
```

### Caso 3: Estudante Iniciante
```
STUDENT: "Como funciona um array em Python?"
ANÁLISE: depth=simplified, exampleType=code, tonal=casual, responseLength=brief
CHOCKS: "Super fácil! Array (lista em Python):
lista = [1, 2, 3]
lista[0]  # → 1
Voilà! Uma coleção de coisas em ordem 📦"
RETORNO: ✅ LIKE
```

---

## 🚀 Próximos Passos (Roadmap)

### Fase 2: Retry Inteligente
Quando user diz "não curti":
- Sistema gera resposta NOVAMENTE
- Usa temperatura mais alta (0.9 em vez de 0.7)
- Aplicaas preferências do perfil

### Fase 3: Dashboard de Análise
Página que mostra:
- Gráfico de satisfação ao longo do tempo
- Evolução do perfil
- Tópicos onde está mais satisfeito
- Sugestões de melhoria para CHOCKS

### Fase 4: Análise IA do Feedback
Use OpenAI para classificar feedback text:
```ts
const classification = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    content: `Classifique este feedback de usuário em dimensões...`
  }]
});
// Retorna: {tone: 'casual', depth: 'simplified', ...}
```

### Fase 5: A/B Testing
Testar diferentes prompts e medir qual gera mais satisfação.

### Fase 6: Persistência de Message IDs
Atual: usa `message.id` optional
Ideal: Todas as mensagens têm ID persistente no banco
```sql
ALTER TABLE messages ADD COLUMN IF NOT EXISTS uuid TEXT;
CREATE UNIQUE INDEX ON messages(uuid);
```

---

## 📝 Documentação

- `PSYCHOLOGICAL_PROFILE_SYSTEM.md` - Guia completo do sistema
- `TESTING_FEEDBACK_SYSTEM.md` - Plano de testes detalhado
- Código bem comentado em:
  - `psychological-profile.ts`
  - `MessageFeedback.tsx`
  - `route.ts` (chat/feedback)

---

## ⚙️ Como Usar

### Para Desenvolvedores

1. **Executar migration SQL** (ver `PSYCHOLOGICAL_PROFILE_SYSTEM.md`)
2. **Testar** seguindo `TESTING_FEEDBACK_SYSTEM.md`
3. **Customizar análise** em `analyzePatterns()` do `psychological-profile.ts`
4. **Monitorar** com queries SQL

### Para Usuários

1. As respostas do CHOCKS vão incluindo botões de feedback
2. Clique "Cuki" se gostou, "Não curti" se não
3. Se dislike, pode descrever o que melhorar (opcional)
4. A cada novo feedback, CHOCKS aprende mais sobre suas preferências
5. Próximas respostas são progressivamente mais personalizadas

---

## 🎯 Status

✅ **Implementação: 100% Completa**
- Tipos de dados
- Backend de perfil psicológico
- Componente visual
- API de feedback
- Integração com chat

⏳ **Testes: Pendentes** (ver `TESTING_FEEDBACK_SYSTEM.md`)

⏳ **Features Avançadas: Planejadas**
- Retry inteligente
- Dashboard de análise
- IA análise de feedback

---

## 💬 Perguntas Frequentes

**P: E se o usuário não der feedback?**
R: O sistema continua respondendo normalmente, sem personalização, até ter pelo menos alguns feedbacks.

**P: E se der feedback conflitante?**
R: O sistema faz média. Ex: 2x "muito técnico" e 1x "muito simples" → `depthPreference = 'balanced'`

**P: Dados do perfil são privados?**
R: Sim! Cada usuário tem seu próprio perfil, salvo no banco com acesso apenas a quem está logado.

**P: Posso resetar meu perfil?**
R: Sim, um admin pode executar:
```sql
DELETE FROM user_psychological_profiles WHERE user_id = 'xyz';
```

---

**Criado com ❤️ para personalização inteligente do CHOCKS**

Versão: 1.0 | Data: 2026-04-14 | Status: Production Ready (após testes)

# 📊 Sistema de Feedback e Perfil Psicológico

## Visão Geral

Sistema completo que permite aos usuários avaliar respostas (like/dislike) e o CHOCKS **rastrear e aprender as preferências psicológicas** do usuário para adaptar futuras respostas.

---

## 🔄 Fluxo Completo

```
Usuário recebe resposta do CHOCKS
        ↓
Clica em "Cuki" (like) ou "Não curti" (dislike)
        ↓
Se dislike → Modal para feedback textual opcional
        ↓
Feedback é enviado para /api/chat/feedback
        ↓
Sistema analisa padrões de preferências
        ↓
Perfil psicológico do usuário é atualizado
        ↓
Próximas respostas incluem contexto de preferências no system prompt
```

---

## 📁 Arquivos Criados / Modificados

### 1. **Tipos de Dados**
- `app/lib/api.ts` ✅ - Estendido `Message` com campo `feedback?` e `id?`

### 2. **Backend - Lógica de Perfil Psicológico**
- `app/lib/server/psychological-profile.ts` ✅ - Novo arquivo com:
  - `PsychologicalProfile` - Tipo de dados do perfil
  - `MessageFeedback` - Tipo de feedback
  - `saveFeedback()` - Salva feedback no banco
  - `updatePsychologicalProfile()` - Analisa e atualiza perfil
  - `getPsychologicalProfile()` - Busca perfil
  - `generateProfilePrompt()` - Gera texto de preferências para sistema prompt
  - `analyzePatterns()` - Análise heurística de padrões

### 3. **Migration SQL**
- `app/lib/server/migrations/psychological-profile.migration.ts` ✅
  - Cria tabela `message_feedback`
  - Cria tabela `user_psychological_profiles`

### 4. **Frontend - Componente de Feedback Visual**
- `app/components/MessageFeedback.tsx` ✅ - Componente React com:
  - Botões Like/Dislike
  - Modal para feedback textual quando dislike
  - Estados visuais claros
- `app/components/MessageFeedback.module.css` ✅ - Estilos

### 5. **API Endpoint**
- `app/api/chat/feedback/route.ts` ✅
  - POST `/api/chat/feedback`
  - Salva feedback + atualiza perfil psicológico

### 6. **Integração com Chat**
- `app/api/chat/stream/route.ts` ✅ - Modificado:
  - Importa `getPsychologicalProfile` e `generateProfilePrompt`
  - Função `buildInstructions()` agora recebe perfil psicológico
  - Busca perfil antes de gerar resposta
  - Injeta preferências no system prompt

---

## 🚀 Como Implementar

### Passo 1: Executar Migration SQL

Execute no seu banco de dados PostgreSQL:

```sql
-- Tabela de feedback de mensagens
CREATE TABLE IF NOT EXISTS public.message_feedback (
  id BIGSERIAL PRIMARY KEY,
  message_id BIGINT NOT NULL REFERENCES public.messages(id) ON DELETE CASCADE,
  conversation_id TEXT NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  feedback TEXT NOT NULL CHECK (feedback IN ('like', 'dislike', 'neutral')),
  feedback_text TEXT,
  retry_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(message_id, user_id)
);

-- Tabela de perfil psicológico do usuário
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

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_message_feedback_user_id ON public.message_feedback(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_message_feedback_conversation_id ON public.message_feedback(conversation_id, user_id);
CREATE INDEX IF NOT EXISTS idx_user_psychological_profiles_user_id ON public.user_psychological_profiles(user_id);
```

### Passo 2: Integrar MessageFeedback no MessageBubble

O código já está integrado em `MessageBubble.tsx`, mas você precisa:

1. Gerar IDs únicos para cada mensagem (ao salvar conversas)
2. Passar o `conversationId` correto para o componente

### Passo 3: Testar

1. Logue e envie uma mensagem
2. Clique em "Cuki" ou "Não curti"
3. Se dislike, preencha feedback (opcional) e envie
4. Verifique que feedback foi salvo em `message_feedback`
5. Envie nova pergunta - o perfil será considerado

---

## 📊 Perfil Psicológico - Dimensões

O sistema rastreia **6 dimensões** de preferência:

| Dimensão | Opções | O que significa |
|----------|--------|-----------------|
| **Tonal** | formal / casual / *balanced* | Formalidade das respostas |
| **Profundidade** | simplified / technical / *balanced* | Nível de detalhe técnico |
| **Estrutura** | narrative / list / *mixed* | Formato (parágrafo vs bullet) |
| **Ritmo** | fast / detailed / *balanced* | Concisão vs profundidade |
| **Exemplos** | code / conceptual / *mixed* | Tipo de exemplo preferido |
| **Comprimento** | brief / comprehensive / *balanced* | Tamanho da resposta |

---

## 🧠 Como a Análise Funciona

### Opção 1: Análise Heurística (Atual)
O sistema analisa o texto do feedback não-estruturado:
- Se usuário escreve "muito formal" → próximo tom será casual
- Se escreve "muito técnico" → próximo será simplificado
- etc.

### Opção 2: Análise com OpenAI (Futura)
Podemos usar a API OpenAI para classificar automaticamente o feedback:
```ts
const classification = await analyzeWithOpenAI(feedbackText);
// Retorna: { tonalPreference: 'casual', depthPreference: 'simplified', ... }
```

---

## 💾 Exemplo de Perfil Gerado

```json
{
  "userId": "user-123",
  "tonalPreference": "casual",
  "depthPreference": "technical",
  "structurePreference": "list",
  "pacePreference": "fast",
  "exampleType": "code",
  "responseLength": "brief",
  "confidenceScore": 0.75,
  "totalFeedback": 20,
  "likeCount": 16,
  "dislikeCount": 4,
  "lastUpdated": "2026-04-14T10:30:00Z"
}
```

---

## 🎯 Prompts Gerados

Quando o perfil é detectado, o sistema injeta no system prompt:

```
## PREFERÊNCIAS DO USUÁRIO (Análise Psicológica)
- Usar tom casual e amigável
- Aprofundar em detalhes técnicos
- Usar listas e bullet points
- Ser conciso e ir direto ao ponto
- Fornecer exemplos de código quando possível
- Manter respostas breves e objetivas
Confiança desta análise: 75%
(Baseado em 20 respostas avaliadas: 16 positivas, 4 negativas)
```

---

## ⚠️ Funcionalidades Futuras (Not implemented yet)

### 1. **Retry Inteligente**
Quando feedback é "dislike":
- Sistema tenta gerar resposta novamente
- Usa temperatura mais alta
- Aplica preferências do perfil

```ts
if (feedback === 'dislike') {
  // Retry com temperatura 0.9 em vez de 0.7
  // Usa generateProfilePrompt() para customizar
  response = await createResponseStream(
    apiKey,
    {
      ...options,
      temperature: 0.9,
      instructions: buildInstructions(..., profile),
    }
  );
}
```

### 2. **Dashboard de Análise**
Pagina que mostra:
- Gráfico de satisfação (likes vs dislikes)
- Evolução do perfil ao longo do tempo
- Tópicos onde o usuário está mais/menos satisfeito
- Sugestões de como o CHOCKS pode melhorar

### 3. **Persistência de ID de Mensagem**
Atualmente Messages não salvam ID. Precisamos:
- Adicionar coluna `message_id` ou usar `BIGINT PK`
- Passar ID para frontend ao carregar conversas
- Renderizar ID no MessageFeedback

### 4. **Análise IA do Feedback Text**
Use OpenAI para classificar feedback automaticamente:
```ts
const analysis = await openai.chat.completions.create({
  model: 'gpt-4',
  messages: [{
    role: 'user',
    content: `Classifique este feedback em dimensões de preferência:\n\n"Muito técnico, prefiro explicações simples"`,
  }],
});
```

### 5. **A/B Testing**
Testar diferentes prompts e medir satisfação dos usuários.

---

## 🔍 Debug

### Ver feedback de um usuário:
```sql
SELECT mf.*, m.content 
FROM message_feedback mf
JOIN messages m ON mf.message_id = m.id
WHERE mf.user_id = 'user-123'
ORDER BY mf.created_at DESC
LIMIT 20;
```

### Ver perfil psicológico:
```sql
SELECT * FROM user_psychological_profiles
WHERE user_id = 'user-123';
```

### Resetar perfil de um usuário:
```sql
DELETE FROM user_psychological_profiles WHERE user_id = 'user-123';
```

---

## 📝 Próximos Passos

1. ✅ Estrutura de dados criada
2. ✅ API endpoint criado
3. ✅ Componente visual criado
4. ✅ Integração com chat criada
5. ⏳ **Testar end-to-end**
6. ⏳ Implementar retry inteligente
7. ⏳ Dashboard de análise
8. ⏳ Persistência correta de message IDs
9. ⏳ Análise IA do feedback text

---

## 🎓 Como o Perfil Psicológico Melhora Respostas

```
Iteração 1: Resposta genérica
User: "Oi, tudo bem?"
Chocks: "Olá! Tudo bem sim. Como posso ajudar?"
User: [não curti - muito formal]

↓ Sistema aprende: tonalPreference = casual, responseLength = brief

Iteração 2: Resposta personalizada (com prefêrências injetadas)
User: "Como faço um loop em Python?"
Chocks: [Com tom casual, breve, com exemplo de código]
"Bora lá! Um loop simples em Python:
for i in range(10):
    print(i)
Pronto! 🚀"
User: [curti!]
```

---

Este é um sistema **adaptativo** que aprende o perfil psicológico de cada usuário e melhora as respostas ao longo do tempo! 🧠✨

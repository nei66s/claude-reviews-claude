# 🔧 Quick Start Técnico - Sistema de Feedback Psicológico

## Resumo das Mudanças

### Arquivos Criados (4)
```
app/lib/server/psychological-profile.ts          ✅ Lógica principal
app/components/MessageFeedback.tsx               ✅ Componente visual
app/components/MessageFeedback.module.css        ✅ Estilos
app/api/chat/feedback/route.ts                   ✅ API endpoint
```

### Arquivos Modificados (3)
```
app/lib/api.ts                                   ✅ +feedback, +id
app/components/MessageBubble.tsx                 ✅ +import, +render
app/api/chat/stream/route.ts                     ✅ +import, +integration
```

### Migrations (1)
```
app/lib/server/migrations/psychological-profile.migration.ts  ✅ SQL
```

---

## 🚀 Deploy em 5 Passos

### 1. Copiar Arquivos
```bash
# Assumindo que os arquivos já foram criados
# Nenhuma ação necessária - arquivos já estão no workspace
✅ Pronto
```

### 2. Executar Migration SQL
```bash
# Conectar ao banco PostgreSQL com psql ou seu tool favorito
psql -h 147.93.176.5 -U chocks_user -d chocks < migration.sql

# OU executar os comandos SQL do arquivo:
# app/lib/server/migrations/psychological-profile.migration.ts
```

### 3. Verificar Imports e TypeScript

```bash
# No diretório do projeto
npm run build

# Deve compilar sem erros
# Se houver erro de tipos, verificar:
# - imports faltando em route.ts
# - tipos não exportados de psychological-profile.ts
```

### 4. Testar API
```bash
curl -X POST http://localhost:3000/api/chat/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -d '{
    "conversationId": "conv-123",
    "messageId": "msg-456",
    "feedback": "like",
    "feedbackText": null
  }'

# Resposta esperada:
# {
#   "success": true,
#   "feedback": { ... },
#   "profile": { ... }
# }
```

### 5. Testar UI
```bash
1. Abrir aplicativo em browser
2. Enviar pergunta
3. Aguardar resposta
4. Clicar em "Cuki" ou "Não curti"
5. Ver feedback modal (se dislike)
6. Verificar que requisição foi feita para /api/chat/feedback
```

---

## 📊 Exemplo de Prompt Gerado

### Perfil do Usuário (após 20 feedbacks)
```json
{
  "userId": "user-alice-123",
  "tonalPreference": "casual",
  "depthPreference": "technical",
  "structurePreference": "list",
  "pacePreference": "fast",
  "exampleType": "code",
  "responseLength": "brief",
  "confidenceScore": 0.82,
  "totalFeedback": 20,
  "likeCount": 17,
  "dislikeCount": 3,
  "lastUpdated": "2026-04-14T15:30:00Z"
}
```

### System Prompt Injetado (generateProfilePrompt)
```
## PREFERÊNCIAS DO USUÁRIO (Análise Psicológica)
- Usar tom casual e amigável
- Aprofundar em detalhes técnicos
- Usar listas e bullet points
- Ser conciso e ir direto ao ponto
- Fornecer exemplos de código quando possível
- Manter respostas breves e objetivas
Confiança desta análise: 82%
(Baseado em 20 respostas avaliadas: 17 positivas, 3 negativas)
```

### Resposta Gerada (com contexto)
```
User: "Como fazer lazy loading de imagens em React?"

CHOCKS (COM CONTEXTO PERSONALIZADO):
"Bora lá! 3 formas:

1. Intersection Observer (recomendado):
const ref = useRef();
useEffect(() => {
  const obs = new IntersectionObserver(([e]) => {
    e.target.src = e.target.dataset.src;
  });
  obs.observe(ref.current);
}, []);

2. React Lazy (built-in) - só pra code-split
const ImageComp = lazy(() => import('./Image'));

3. Library (easiest)
npm i react-lazyload

Pronto! 🚀"
```

---

## 🐛 Debugando Localmente

### Log de Perfil Psicológico
```ts
// Em app/api/chat/stream/route.ts, linha ~987
const psychProfile = await getPsychologicalProfile(user.id).catch(() => null);
console.log('🧠 Psychology Profile:', {
  userId: user.id,
  profile: psychProfile,
  promptInjected: psychProfile ? generateProfilePrompt(psychProfile) : null
});
```

### Verificar Feedback Salvo
```sql
-- Conectar ao banco e executar:
SELECT 
  mf.id,
  mf.user_id,
  mf.feedback,
  mf.feedback_text,
  mf.created_at
FROM message_feedback mf
ORDER BY mf.created_at DESC
LIMIT 10;
```

### Verificar Perfil Atualizado
```sql
SELECT 
  usr.id,
  usr.tonal_preference,
  usr.depth_preference,
  usr.structure_preference,
  usr.pace_preference,
  usr.example_type,
  usr.response_length,
  ROUND(usr.confidence_score::numeric, 2) as confidence,
  usr.total_feedback,
  usr.like_count,
  usr.dislike_count,
  usr.updated_at
FROM user_psychological_profiles usr
ORDER BY usr.updated_at DESC
LIMIT 5;
```

---

## 🔍 Checklist Pré-Deploy

- [ ] Todos os arquivos TS compilam (`npm run build` sem erros)
- [ ] TypeScript types estão corretos (psych-profile, feedback, etc)
- [ ] Migration SQL foi executada no banco
- [ ] Tabelas existem: `message_feedback`, `user_psychological_profiles`
- [ ] Índices foram criados
- [ ] API endpoint `/api/chat/feedback` responde corretamente
- [ ] MessageFeedback component renderiza sem erros
- [ ] Botões de feedback aparecem em respostas do agent
- [ ] Feedback é salvo no banco (verificar com SELECT)
- [ ] Perfil psicológico é atualizado após 3+ feedbacks
- [ ] Context é injetado no prompt quando confidenceScore > 0.3
- [ ] Próximas respostas consideram perfil (verificar logs)
- [ ] Sem memory leaks ou console.log de debug

---

## 📈 Monitoramento Pós-Deploy

### Queries de Monitoramento
```sql
-- Usuários com feedback
SELECT 
  COUNT(DISTINCT mf.user_id) as usuarios_com_feedback,
  COUNT(mf.id) as total_feedback,
  ROUND(100.0 * SUM(CASE WHEN mf.feedback = 'like' THEN 1 ELSE 0 END) / COUNT(mf.id), 1) as like_percentage
FROM message_feedback mf;

-- Distribuição de preferências
SELECT 
  depth_preference,
  COUNT(*) as usuarios
FROM user_psychological_profiles
GROUP BY depth_preference;

-- Confiança média do sistema
SELECT 
  ROUND(AVG(confidence_score::numeric), 2) as confianca_media,
  MIN(confidence_score) as minima,
  MAX(confidence_score) as maxima,
  COUNT(*) as total_usuarios
FROM user_psychological_profiles;
```

### Alertas Recomendados
- Se `message_feedback` cresce sem `user_psychological_profiles` ser atualizado
- Se `confidence_score` nunca ultrapassa 0.3 (analysis não está funcionando)
- Se API `/api/chat/feedback` retorna erro > 1% das vezes

---

## 🧪 Testes Rápidos

### Teste 1: Feedback API
```bash
# Enviar like
curl -X POST localhost:3000/api/chat/feedback \
  -H "Auth: Bearer TOKEN" \
  -d '{"messageId":"1","conversationId":"c1","feedback":"like"}'

# Enviar dislike com texto
curl -X POST localhost:3000/api/chat/feedback \
  -H "Auth: Bearer TOKEN" \
  -d '{"messageId":"2","conversationId":"c1","feedback":"dislike","feedbackText":"Muito formal"}'
```

### Teste 2: Perfil Geração
```ts
// No browser console ou Node REPL
const profile = {
  tonalPreference: 'casual',
  depthPreference: 'technical',
  structurePreference: 'list',
  pacePreference: 'fast',
  exampleType: 'code',
  responseLength: 'brief',
  confidenceScore: 0.75,
  totalFeedback: 15,
  likeCount: 12,
  dislikeCount: 3,
};

const prompt = generateProfilePrompt(profile);
console.log(prompt);
// Deve exibir preferências em português
```

### Teste 3: Integração Completa
```
1. Login com usuário de teste
2. Enviar pergunta
3. Clicar "Não curti" + feedback
4. Enviar outra pergunta
5. Verificar que nova resposta considera feedback
6. Verificar em DB que perfil foi atualizado
```

---

## 🔤 Referência de Tipos

```typescript
// FeedbackType
type FeedbackType = "like" | "dislike" | null;

// PsychologicalProfile
interface PsychologicalProfile {
  userId: string;
  tonalPreference: "formal" | "casual" | "balanced";
  depthPreference: "simplified" | "technical" | "balanced";
  structurePreference: "narrative" | "list" | "mixed";
  pacePreference: "fast" | "detailed" | "balanced";
  exampleType: "code" | "conceptual" | "mixed";
  responseLength: "brief" | "comprehensive" | "balanced";
  confidenceScore: number;  // 0-1
  totalFeedback: number;
  likeCount: number;
  dislikeCount: number;
  lastUpdated: Date;
}

// MessageFeedback
interface MessageFeedback {
  messageId: string;
  conversationId: string;
  userId: string;
  feedback: FeedbackType;
  feedbackText?: string;
  createdAt: Date;
  retryCount?: number;
}

// Estendido Message
interface Message {
  id?: string;  // NOVO
  role: "user" | "agent";
  content: string;
  streaming?: boolean;
  trace?: TraceEntry[];
  attachments?: Attachment[];
  feedback?: FeedbackType;  // NOVO
}
```

---

## 🚨 Troubleshooting Rápido

| Problema | Solução |
|----------|---------|
| `Cannot find module 'psychological-profile'` | Verificar import path em route.ts |
| `MessageFeedback is not exported` | Verificar export default em component |
| `TypeError: generateProfilePrompt is not a function` | Verificar que é imported em route.ts |
| `Foreign key constraint violation` | message_feedback.message_id não existe - verificar se mensagens têm ID |
| Buttons não aparecem | Verificar que `message.id` está sendo passado em MessageBubble |
| Profile não atualiza | Verificar que mutation foi executada no banco SQL |
| Confidence sempre 0 | analyzePatterns() está detectando padrões? Verificar feedback_text |

---

## 📞 Suporte Rápido

### Arquivos Principais
- Lógica: `app/lib/server/psychological-profile.ts`
- UI: `app/components/MessageFeedback.tsx`
- API: `app/api/chat/feedback/route.ts`
- Integration: `app/api/chat/stream/route.ts` (buildInstructions)

### Linha de Comando Útil
```bash
# Build
npm run build

# Dev
npm run dev

# Type check
npx tsc --noEmit

# Search
grep -r "getPsychologicalProfile" app/

# Test SQL
psql -h 147.93.176.5 -U chocks_user -d chocks -c "SELECT * FROM message_feedback LIMIT 1;"
```

---

**Status**: 🟢 Ready to Deploy (após testes da Fase 1-5)

Próxima ação: Execute `TESTING_FEEDBACK_SYSTEM.md` e reporte resultados!

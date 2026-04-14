# 🧪 Guia de Testes - Sistema de Feedback Psicológico

## Checklist de Testes

### ✅ Fase 1: Verificar Estrutura

- [ ] Todos os arquivos foram criados:
  - `app/lib/server/psychological-profile.ts`
  - `app/components/MessageFeedback.tsx`
  - `app/components/MessageFeedback.module.css`
  - `app/api/chat/feedback/route.ts`
  - `app/lib/server/migrations/psychological-profile.migration.ts`

- [ ] Tipos atualizados em `app/lib/api.ts`:
  - [ ] `Message` tem campo `feedback?: "like" | "dislike" | null`
  - [ ] `Message` tem campo `id?: string`

- [ ] Imports atualizados em `app/api/chat/stream/route.ts`:
  - [ ] `getPsychologicalProfile`
  - [ ] `generateProfilePrompt`
  - [ ] `PsychologicalProfile`

- [ ] Função `buildInstructions` foi atualizada:
  - [ ] Recebe parâmetro `psychProfile?: PsychologicalProfile | null`
  - [ ] Injeta perfil no system prompt quando disponível

### ✅ Fase 2: Preparar Banco de Dados

- [ ] Conectar ao banco PostgreSQL
- [ ] Executar migration SQL (ver `PSYCHOLOGICAL_PROFILE_SYSTEM.md`)
- [ ] Verificar que tabelas foram criadas:
  ```sql
  SELECT table_name FROM information_schema.tables 
  WHERE table_schema = 'public' AND table_name LIKE '%message_feedback%';
  ```
- [ ] Verificar índices foram criados:
  ```sql
  SELECT indexname FROM pg_indexes 
  WHERE tablename IN ('message_feedback', 'user_psychological_profiles');
  ```

### ✅ Fase 3: Testes Manuais

#### Teste 3.1: Enviar Mensagem e Ver Feedback Buttons

1. Logue no aplicativo
2. Envie uma pergunta: "Como faço um loop em Python?"
3. Aguarde a resposta do CHOCKS
4. **Verificar**: Devem aparecer botões abaixo da resposta:
   - "👍 Cuki"
   - "👎 Não curti"

**Esperado**: Botões aparecem com estilo verde e vermelho

#### Teste 3.2: Clicar em "Cuki" (Like)

1. Clique no botão "Cuki"
2. **Verificar**: 
   - Botão fica verde com checkmark
   - Mensagem aparece: "✅ Obrigado! Você gostou desta resposta"

**No banco**:
```sql
SELECT * FROM message_feedback 
WHERE user_id = 'seu-user-id' AND feedback = 'like'
ORDER BY created_at DESC LIMIT 1;
```

#### Teste 3.3: Clicar em "Não curti" (Dislike)

1. Clique no botão "Não curti"
2. **Verificar**: 
   - Modal aparece com textarea
   - Pergunta: "Por que você não gostou?"
   - Botões: "Cancelar" e "Enviar Feedback"

3. Digite feedback: "Muito técnico, prefiro exemplos mais simples"
4. Clique "Enviar Feedback"

**Esperado**:
- Modal fecha
- Mensagem aparece: "📊 Entendido. Vou tentar melhorar nas próximas respostas"
- Feedback é salvo no banco

**No banco**:
```sql
SELECT * FROM message_feedback 
WHERE user_id = 'seu-user-id' AND feedback = 'dislike'
ORDER BY created_at DESC LIMIT 1;
```

#### Teste 3.4: Verificar Perfil Psicológico Atualizado

Após enviar vários feedbacks (pelo menos 3-5):

```sql
SELECT * FROM user_psychological_profiles 
WHERE user_id = 'seu-user-id';
```

**Esperado**:
- `total_feedback` > 0
- `like_count` ou `dislike_count` > 0
- Preferências mudaram (ex: `depth_preference = 'simplified'`)
- `confidence_score` > 0 (aumenta com mais feedback)

#### Teste 3.5: Verificar Contexto do Perfil nas Respostas

1. Acumular pelo menos 5 feedbacks com padrão claro
   - Ex: 5x "dislike" com feedback "muito formal"

2. Enviar nova pergunta
3. Monitorar logs para confirmar que perfil foi injetado:

```
No console/logs do servidor, você deve ver:
- "Buscando perfil psicológico para user-123..."
- "Perfil encontrado: depthPreference='simplified', tonalPreference='casual'..."
- System prompt incluindo "## PREFERÊNCIAS DO USUÁRIO"
```

### ✅ Fase 4: Testes de Integração

#### Teste 4.1: Múltiplos Usuários

1. Crie 2 contas de teste
2. Conte User A apenas como "Like" → depth = "technical"
3. Conte User B como "Dislike" com "muito técnico" → depth = "simplified"
4. Ambos e mesma pergunta

**Esperado**: Respostas são diferentes, adaptadas ao perfil de cada um

#### Teste 4.2: Persistência de Conversas

1. Envie feedback
2. Feche o navegador
3. Reabra e execute um logout/login
4. Volte à conversa anterior

**Esperado**: Feedback ainda está lá, botões ou mensagens mostram feedback anterior

#### Teste 4.3: Performance

- Envie múltiplas mensagens em rápida sucessão
- Feedback de cada uma

**Esperado**: Sem lentidão, API responde em < 1s

### ✅ Fase 5: Testes Edge Cases

#### Edge Case 5.1: Sem Feedback

Enviar pergunta sem clicar em feedback:
- **Esperado**: Perfil não é atualizado

#### Edge Case 5.2: Mudar de Ideia

Clicar em "Cuki" depois mudar para "Não curti":
- **Esperado**: Última escolha é salva (UPDATE, não INSERT)

```sql
-- Deve haver um único registro por mensagem+usuário
SELECT message_id, user_id, COUNT(*) as cnt 
FROM message_feedback 
GROUP BY message_id, user_id 
HAVING COUNT(*) > 1;

-- Resultado esperado: (0 rows)
```

#### Edge Case 5.3: Banco Indisponível

Se banco está down:
- **Esperado**: Erro é capturado, mensagem é salva sem feedback
- **Não esperado**: Crash do servidor

#### Edge Case 5.4: Perfil com Confiança Baixa

Se usuario tem apenas 1 feedback:
- **Esperado**: Contexto de perfil NÃO é injetado (confidenceScore < 0.3)

```ts
// No código: linha 443
if (psychProfile && psychProfile.totalFeedback > 0 && psychProfile.confidenceScore > 0.3) {
  // Injeta perfil
}
```

---

## 📊 Cenários de Teste Recomendados

### Cenário 1: Usuário Perfeccionista (Depth = Technical)

```
Feedback histórico:
❌ "Muito superficial"
❌ "Precisa de mais detalhes"
❌ "Simplificou demais"
✅ "Com código e teoria" 

Profile esperado:
- depth_preference = 'technical'
- example_type = 'code'
- response_length = 'comprehensive'
```

### Cenário 2: Usuário Casual (Tone = Casual)

```
Feedback histórico:
❌ "Muito formal"
❌ "Chato demais"
✅ "Adorei a liberdade"
✅ "Muito sua cara"

Profile esperado:
- tonal_preference = 'casual'
- pace_preference = 'fast'
- response_length = 'brief'
```

### Cenário 3: Usuário Indeciso (All Balanced)

```
Feedback histórico:
✅ Uma resposta formal
✅ Uma resposta casual
❌ Muito longo
✅ Bem estruturado

Profile esperado:
- Todas as dimensões = 'balanced'
- confidenceScore = 0.2 (baixa confiança)
```

---

## 🐛 Troubleshooting

### Problema: Botões de feedback não aparecem

**Checklist**:
- [ ] `MessageFeedback` está importado em `MessageBubble`?
- [ ] Mensagem tem `message.id` definido?
- [ ] CSS do módulo está sendo carregado?
- [ ] Browser DevTools mostra erro?

**Solução**:
```ts
// Em MessageBubble.tsx, linha ~150
{isAgent && message.id && (
  <div className="message-feedback-wrapper">
    <MessageFeedback ... />
  </div>
)}
```

### Problema: API Feedback retorna 400

**Checklist**:
- [ ] POST body tem `messageId`, `conversationId`, `feedback`?
- [ ] Usuário está autenticado (token válido)?

**Solução**:
```bash
# Test endpoint
curl -X POST http://localhost:3000/api/chat/feedback \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "messageId": "123",
    "conversationId": "conv-456",
    "feedback": "like",
    "feedbackText": null
  }'
```

### Problema: Perfil não é atualizado

**Checklist**:
- [ ] Tabelas existem no banco? (`SELECT * FROM user_psychological_profiles`)
- [ ] Feedback foi salvo? (`SELECT * FROM message_feedback`)
- [ ] Usuario tem > 0 feedbacks?
- [ ] Logs mostram erro em `updatePsychologicalProfile`?

**Debug Query**:
```sql
SELECT 
  mf.user_id,
  COUNT(*) as total_feedback,
  SUM(CASE WHEN mf.feedback = 'like' THEN 1 ELSE 0 END) as likes,
  SUM(CASE WHEN mf.feedback = 'dislike' THEN 1 ELSE 0 END) as dislikes,
  upp.confidence_score
FROM message_feedback mf
LEFT JOIN user_psychological_profiles upp ON mf.user_id = upp.user_id
GROUP BY mf.user_id, upp.confidence_score
ORDER BY total_feedback DESC;
```

### Problema: Contexto de perfil não está sendo injetado

**Checklist** (em `app/api/chat/stream/route.ts`):
- [ ] `getPsychologicalProfile` é chamado? (linha ~987)
- [ ] Resultado é passado para `buildInstructions`? (linha ~1013)
- [ ] `generateProfilePrompt` retorna string não vazia?

**Debug**:
```ts
// Adicione console.log temporário em route.ts
const psychProfile = await getPsychologicalProfile(user.id).catch(() => null);
console.log('Psychology profile:', psychProfile);
if (psychProfile) {
  console.log('Profile prompt:', generateProfilePrompt(psychProfile));
}
```

---

## 📝 Checklist Final

Antes de fazer deploy:

- [ ] Todos os testes da Fase 1-4 passam
- [ ] Edge cases da Fase 5 tratados
- [ ] Banco tem as tabelas criadas e índices otimizados
- [ ] Não há console.log de debug no código
- [ ] MessageFeedback CSS está limpo e sem bugs visuais
- [ ] API feedback retorna dados corretos
- [ ] Perfil psicológico é injetado com confiança > 30%
- [ ] Documentação foi atualizada
- [ ] Equipe foi treinada

---

**Status**: 🟡 **Implementação Completa, Testes Pendentes**

Próximo passo: Executar testes Fase 1-5 e reportar resultados!

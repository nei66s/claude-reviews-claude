# Compaction & Context Management (Responses API)

Este documento descreve a implementação do sistema de compactação de contexto baseado na **Responses API** da OpenAI. Este sistema permite sustentar conversas extremamente longas, reduzindo o consumo de tokens e a latência sem perder o estado crítico da interação.

## 🚀 O que é Compaction?

Compaction é uma técnica onde o modelo resume e "comprime" o histórico da conversa em itens de compactação opacos e criptografados. Esses itens substituem grandes volumes de mensagens anteriores, carregando o raciocínio e o estado necessário para continuar a conversa usando uma fração dos tokens originais.

### Benefícios:
- **Redução de Latência**: Janelas de contexto menores resultam em respostas mais rápidas.
- **Economia de Custo**: Menos tokens de entrada processados em cada turno.
- **Sustentabilidade**: Permite interações que excederiam o limite físico de contexto do modelo.

---

## 🛠️ Implementação Técnica

O sistema utiliza os novos endpoints `/v1/responses` e `/v1/responses/compact`.

### 1. Modos de Operação

#### A. Server-side Compaction (Automático)
Integrado diretamente no fluxo de streaming dos agentes (`streamAgent`).
- **Trigger**: Ativado quando o contexto ultrapassa o `compactThreshold` (configurado para 200.000 tokens).
- **Fluxo**: Durante o streaming, o servidor OpenAI pode emitir um item do tipo `compaction`. O sistema captura esse item e o persiste no banco de dados.
- **Schema**: Adicionado o papel `role: "compaction"` à tabela de mensagens.

#### B. Standalone Compaction (Explícito)
Disponível via função `compactContext` para manutenção preventiva do histórico.
- **Uso**: Pode ser chamado manualmente ou por jobs de limpeza para compactar janelas de mensagens acumuladas.

### 2. Mudanças no Banco de Dados (`app/lib/agent/db.ts`)
A tabela `messages` foi atualizada para aceitar o novo papel de mensagem:
```sql
ALTER TABLE messages ADD CONSTRAINT messages_role_check 
CHECK (role IN ('user', 'agent', 'system', 'compaction'));
```

---

## 📖 Como Funciona no Código

### Ativando via Contexto
Ao chamar os agentes, basta fornecer o `compactThreshold` no objeto de contexto:

```typescript
const result = await streamAgent(messages, {
  compactThreshold: 200000,
  // ...outros campos
}, callbacks);
```

### Processamento de Itens de Compactação
Na biblioteca `llm.ts`, o `streamAgent` agora roteia automaticamente para a Responses API caso detecte que deve usar compactação:

```typescript
if (useResponsesAPI) {
  // Converte mensagens para ResponseItems
  // Chama (client as any).responses.create
  // Captura eventos de tipo 'compaction' no stream
}
```

---

## 📊 Comparação de Performance

| Métrica | Sem Compaction | Com Compaction (Threshold 200k) |
| :--- | :--- | :--- |
| **Crescimento de Contexto** | Linear (ilimitado) | Controlado (estabiliza após threshold) |
| **Latência de Turno** | Aumenta com a conversa | Estável/Previsível |
| **Retenção de Memória** | Perfeita até o limite | Preserva "Key Prior State" via modelo |

---

## 🧪 Verificação e Segurança

O sistema foi implementado garantindo compatibilidade reversa com a Chat Completions API tradicional. Se nenhum threshold for definido e não houver itens de compactação no histórico, o sistema continua usando o motor padrão.

Os itens de compactação são **opacos**:
1. Não devem ser editados manualmente.
2. São persistidos no banco de dados como strings base64/criptografadas no campo `content`.
3. São reinjetados como `type: 'compaction'` nas chamadas subsequentes.

---
*Documentação gerada pelo ecossistema Pimpotasma (Chocks).*

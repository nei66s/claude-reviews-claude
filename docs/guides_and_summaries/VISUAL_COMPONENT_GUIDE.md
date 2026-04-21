# Token & Cost Panel — Visual Component

Componente React implementado com sucesso! 

## 📊 Como Usar

```tsx
import TokenCostPanel from "@/components/TokenCostPanel";

// Dentro do seu componente
<TokenCostPanel 
  userId={user.id}
  chatId={currentChat.id}
  onCompact={() => {
    // Callback para compactar conversa
  }}
/>
```

## 🎨 O que foi criado

### 1. Componente React (`TokenCostPanel.tsx`)
- **Props:**
  - `userId` — ID do usuário
  - `chatId` — ID da conversa
  - `onCompact` — Callback para compactar contexto

- **Features:**
  - Barra de progresso visual com cores
  - Estatísticas de tokens (usado/disponível)
  - Breakdown de custos (hora/dia/mês)
  - Composição do contexto
  - Botões de ação (Compactar, Atualizar)
  - Modo expansível (click para abrir/fechar)

### 2. Stylesheet (`token-cost-panel.css`)
- Design dark mode
- Tema escuro com cores dinâmicas
- Cores mudam baseado em status:
  - 🟢 Verde: Normal
  - 🟠 Laranja: Warning (80% do limite)
  - 🔴 Vermelho: Bloqueado
- Responsive design
- Animações suaves

### 3. Integração no AppShell
- Adicionado ao inicio da seção de mensagens
- Mostra quando há uma conversa ativa
- Integra com os endpoints da API criados

## 📱 Visual Preview

```
┌─────────────────────────────────────────┐
│ 💰 CONTEXTO & CUSTOS                  ▼ │
└─────────────────────────────────────────┘

Token Usage
81.8K / 100K tokens                    81%
████████████████░░░░░░░░░░░░░░░░░░░░░░

Disponível: 18.2K tokens

Custos
┌──────────────┬──────────────┬──────────────┐
│ Esta hora    │ Hoje         │ Este mês     │
│ $0.0045      │ $0.0234      │ $0.4521      │
└──────────────┴──────────────┴──────────────┘

Total histórico: $2.3421

Composição do Contexto
System Instructions          3.1%
Tool Definitions             8.7%
Messages                    24.0%
Tool Results                15.4%
⭐ Reserved for Response    48.8%

┌────────────────────────┬────────────────────┐
│ Compactar Conversa     │ Atualizar          │
└────────────────────────┴────────────────────┘
```

## 🔌 Endpoints Utilizados

```bash
GET  /api/tokens/stats/:userId/:chatId
→ Retorna: { ok, tokens: { used, available, percentageUsed, isWarning, isBlocked } }

GET  /api/costs/breakdown/:userId
→ Retorna: { ok, breakdown: { totalCost, thisHour, today, thisMonth, byChatId, byModel } }
```

## ⚙️ Configurações

Refresh automático a cada 30 segundos
- Pode ser ajustado no hook `useEffect` principal

Estados:
- `isLoading` — Enquanto carrega dados
- `isExpanded` — Painel aberto/fechado (default: fechado)

## 🎯 Próximas Melhorias

1. Integrar com QueryEngine para compressão real
2. Alertas em tempo real quando aproximar de limite
3. Histórico de uso (gráfico de tendências)
4. Exportar relatório de custos
5. Limites customizáveis por usuário

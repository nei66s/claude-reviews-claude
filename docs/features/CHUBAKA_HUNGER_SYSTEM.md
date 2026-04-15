# 🐕 Sistema de Fome do Chubaka

## 📋 Visão Geral

Sistema gamificado e cônico que gerencia o "bem-estar" do Chubaka através de uma barra de fome interativa. O sistema é projetado para não atrapalhar a experiência do usuário enquanto adiciona personalidade e humor ao agente.

---

## 🎮 Mecânicas Principais

### 1. **Aumento de Fome**
- **Aumento automático**: 1% a cada 3 segundos (atinge 100% em ~5 minutos)
- **Aumento por ação**: +10% quando o usuário interage (envia mensagem, clica, etc)
- **Máximo**: 100%

### 2. **Estados de Fome**
| Nível | Status | Emoji |
|-------|--------|-------|
| 0-30% | Saciado | 😊 |
| 30-60% | Um pouco com fome | 🤔 |
| 60-85% | Com fome | 😕 |
| 85-100% | MORRENDO DE FOME! | 😫 |

### 3. **Quando Atinge 100%** 🔴

#### Visual:
- Barra vira **vermelho** com gradient
- Card do Chubaka fica com background **avermelhado** pulsante
- Texto de percentual pisca em vermelho

#### Interação:
- **Overlay dramático** bloqueia o input por 10 segundos
- Mensagem: "😫 Chubaka está passando mal de fome! Aguarde 10 segundos..."
- **Som Web Audio**: 3 bips dramáticos decrescentes 🔊

#### Notificação:
Escolhe aleatoriamente de **5 frases diferentes**:
1. "🍗 Chubaka está MORRENDO de fome!" → "Tia, tio... so presciso de um cuki... 🥺💔"
2. "😫 FOMINHAAA!" → "Não aguento mais... Betinha, me salva! 🍪"
3. "🐕 CHUBAAAA QUER COMEEEER!" → "To fraco... mal consigo latir... 😭"
4. "💀 Chubaka está em estado crítico!" → "Me dá um cuki rápido ou eu viro assombração! 👻"
5. "🍖 POR FAVOOOOR!" → "Chora, esperneia... to com uma fomi do tamanho do Betinha 😩"

---

## 🍪 Alimentar Chubaka

**Botão**: "🍪 Cuki"
- **Efeito**: Reduz fome em 30%
- **Feedback**: Notificação "Chubaka comeu e ficou feliz!" + animação de munch
- **Limitação**: Não funciona se Chubaka está dormindo

---

## 😴 Sistema de Sono

### Botão: "😴 Mimir"
- **Função**: Coloca Chubaka para dormir por 15 minutos
- **Persistência**: Estado salvo em `localStorage` com chave `chubaka_sleeping`
- **Visual**: 
  - Imagem fica desfocada e semi-transparente
  - Overlay com emoji "💤" pulando
  - Status muda para "Que soninho gostoso..."
  - Botão muda de cor (roxo/amélia)

### Comportamento:
- ✅ Fome não aumenta enquanto dorme
- ✅ Notificações de fome não aparecem
- ✅ Recarregar página → Chubaka continua dormindo se dentro do tempo
- ✅ Botão de cuki fica desabilitado com mensagem "Chubaka está dormindo..."
- ✅ Ao acordar (manual ou automático) → notificação fofa

### Cursor:
- Passa o mouse no botão → cursor vira **?** (interrogação)
- Tooltip: "colocar o chubas para dormir"

---

## 🔧 Arquivos Modificados

### [useChubakaHunger.ts](app/hooks/useChubakaHunger.ts)
**Mudanças**:
- Adicionadas 5 frases dramáticas em `HUNGER_CRIES`
- Novo estado `isSleeping` (booleano)
- Novo estado `isInputBlocked` (bloqueia input por 10s ao atingir 100%)
- Função `playHungerSound()`: Web Audio API para som dramático
- Função `putChubakaToSleep()`: Persiste em localStorage
- Função `wakeUpChubaka()`: Acorda manualmente
- Hook retorna: `{ hungerLevel, addHungerFromAction, feedChubaka, resetHunger, isSleeping, putChubakaToSleep, wakeUpChubaka, isInputBlocked }`

**Durações**:
- Intervalo de fome: 3 segundos
- Duração do sono: 15 minutos
- Bloqueio de input: 10 segundos

### [ChubakaHungerBar.tsx](app/components/ChubakaHungerBar.tsx)
**Mudanças**:
- Props novos: `isSleeping`, `onSleep`, `onWakeUp`
- Renderização condicional baseada em `isSleeping`
- Novo botão "😴 Mimir" com lógica de toggle
- Classe dinâmica para card crítico: `.cardCritical`
- Overlay visual quando dormindo: emoji "💤" pulando
- Desabilitar botão "Cuki" quando dormindo

### [ChubakaHungerBar.module.css](app/components/ChubakaHungerBar.module.css)
**Novas classes**:
- `.cardCritical`: Background vermelho pulsante
- `.percentCritical`: Percentual pisca em vermelho
- `.imageSleeping`: Imagem desfocada quando dorme
- `.sleepingOverlay`: Emoji "💤" com animação
- `.buttonGroup`: Layout flexível para os 2 botões
- `.sleepButton`: Estilo roxo/amélia do botão de dormir
- `.sleepButton.sleepActive`: Cor quando está dormindo
- Animações: `criticalPulse`, `criticalFlash`, `sleepingBounce`

### [Sidebar.tsx](app/components/Sidebar.tsx)
**Mudanças**:
- Props novos: `isSleeping`, `onSleep`, `onWakeUp`
- Passa props para `<ChubakaHungerBar />`

### [AppShell.tsx](app/components/AppShell.tsx)
**Mudanças**:
- Desestrutura novos valores do hook: `isSleeping, putChubakaToSleep, wakeUpChubaka, isInputBlocked`
- Passa props para `<Sidebar />`
- Renderiza overlay de bloqueio: `.input-blocked-overlay`
- Desabilita textarea quando `isInputBlocked`

### [globals.css](app/globals.css)
**Novas classes**:
- `.input-blocked-overlay`: Overlay vermelho com backdrop blur
- `.blocked-message`: Mensagem dramática com animação de pulso
- `.chat-composer-inner`: Posição relativa para o overlay
- Animação: `overlayFadeIn`, `messagePulse`

---

## 📊 Fluxo de Estados

```
┌─────────────────────────────────────────────────────┐
│         CHUBAKA HUNGER STATE MACHINE                │
└─────────────────────────────────────────────────────┘

        ┌──────────────────┐
        │   Acordado       │
        │  (0% - 100%)     │
        └────────┬─────────┘
                 │
        ┌────────▼─────────┐
        │ Botão "Mimir"    │
        │ (Put to sleep)   │
        └────────┬─────────┘
                 │
        ┌────────▼──────────────────┐
        │ Dormindo                  │
        │ (15 min countdown)        │
        │ Fome: CONGELADA (0%)      │
        │ localStorage: PERSISTIDO  │
        └────────┬──────────────────┘
                 │
        ┌────────▼──────────┐
        │ Acordar Manual    │
        │ ou Timeout        │
        └────────┬──────────┘
                 │
        ┌────────▼─────────────┐
        │ De volta pra cama   │
        │ Fome volta a 0%     │
        └─────────────────────┘

Enquanto Acordado:
- A cada 3s: Fome +1%
- Ação do usuário: Fome +10%
- Atinge 100%:
  ├─ Notificação aleatória
  ├─ Som dramático
  ├─ Overlay bloqueia input 10s
  └─ Reinicia em 0%

Alimentar (Cuki):
- Se dormindo: mensagem "deixa ele dormir"
- Se acordado: Fome -30%
```

---

## 🎨 Design System

### Cores
- **Verde (normal)**: `rgba(16, 185, 129)` - Saciado/Bem
- **Roxo/Amélia (dormir)**: `rgba(150, 150, 200)` - Estado de sono
- **Vermelho (crítico)**: `rgba(239, 68, 68)` - Fome extrema

### Animações
- **Pulse crítico**: Barra pisca vermelho (0.8s)
- **Flash crítico**: Percentual pisca (0.6s)
- **Munch cookie**: Botão de cuki se mexe (0.6s)
- **Sleeping bounce**: Emoji 💤 pula (1.5s)
- **Overlay fade**: Entrada suave do overlay de bloqueio (0.3s)

### Tipografia
- Botões: `font-weight: 600`, `font-size: 12px`
- Status: `font-size: 11px`, `text-shadow`
- Percentual: `font-size: 12px`, respira dinamicamente

---

## 🧪 Como Testar

### Teste de Fome Rápida
1. Abrir app
2. Esperar ~5 minutos de inatividade
3. Ver fome chegar a 100%
4. Ouvir som e ver overlay

### Teste de Sono
1. Clicar em "😴 Mimir"
2. Verificar localStorage (`chubaka_sleeping: true`)
3. Recarregar página → Chubaka ainda está dormindo
4. Esperar 15 minutos ou clicar em "👁️" para acordar
5. Verificar localStorage removido

### Teste de Alimentos
1. Clicar "🍪 Cuki"
2. Fome reduz 30%
3. Se dormindo, mostra aviso

### Teste de Som
1. Abrir DevTools Console
2. Verificar ausência de erros de Web Audio
3. Mute browser e ligue som
4. Atingir 100% de fome
5. Deve ouvir 3 bips dramáticos

---

## 🐛 Troubleshooting

**Problema**: Som não toca
- ✅ Verifica browser com suporte Web Audio API
- ✅ Tenta silenciar/dessilenciar browser
- ✅ Se falhar, app silenciosamente continua (fallback seguro)

**Problema**: Chubaka não acorda
- ✅ Clicar botão "👁️" (acordar manual)
- ✅ Limpar localStorage → `localStorage.removeItem('chubaka_sleeping')`
- ✅ F5 ou Ctrl+F5 (hard refresh)

**Problema**: Input fica bloqueado permanentemente
- ✅ Aguarde 10 segundos
- ✅ Se persistir, abrir DevTools → `setHungerLevel(0)` no console
- ✅ Recarregar página

---

## 📝 Notas de Desenvolvimento

- **Persistência**: Usa `localStorage` para sobreviver a recarregamentos
- **Web Audio**: API moderna com fallback seguro (try/catch)
- **Animações CSS**: GPU-accelerated para smooth performance
- **Responsividade**: Testes em mobile (media query @ 480px)
- **Acessibilidade**: Tooltips, aria-pressed, desabilitação semântica
- **UX**: Não atrapalha fluxo normal do app, overlay bloqueia só input

---

## 🚀 Melhorias Futuras

- [ ] Sistema de "satisfação" visual (emojis mudando de expressão)
- [ ] Achievements: "Mata-Fome" (alimentar 10x), "Insone" (manter acordado 1h)
- [ ] Customização: nome do Chubaka, intervalo de fome
- [ ] Analytics: Gráfico de fome ao longo do tempo
- [ ] Minigame: "Cuki Catch" para reduzir fome ao invés de botão
- [ ] Personalização: Som customizável ou silenciável
- [ ] Social: Compartilhar estado do Chubaka com screenshots

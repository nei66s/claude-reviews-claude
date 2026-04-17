# 📱 Mobile-First Layout - Índice Completo

> **Stack**: React 18 + Next.js 14 + Tailwind CSS 3  
> **Objetivo**: Layout nativo mobile-first responsivo para iOS/Android

---

## 📂 Arquivos Criados

### 1. **MobileAppLayout.tsx** 
   - 📍 `app/components/MobileAppLayout.tsx`
   - **Conteúdo**: Componentes reutilizáveis base
   - **Componentes**:
     - `MobileAppLayout` - Container principal com header/footer
     - `MobileHeader` - Header compacto com ações
     - `MobileBottomNav` - Navegação inferior (iOS/Android style)
     - `MobileContent` - Container com padding consistente
     - `MobileCard` - Card com feedback ao toque
     - `MobileButton` - Botão acessível 44px
     - `MobileInput` - Input otimizado com ícone
   - **Use quando**: Precisar de componentes individuais reutilizáveis

### 2. **MobileAppExample.tsx**
   - 📍 `app/components/MobileAppExample.tsx`
   - **Conteúdo**: App completa funcional com exemplo
   - **Features**:
     - Navegação com 4 abas
     - Home screen com cards
     - Search screen com input
     - Create screen com formulário
     - Profile screen com menu
   - **Use quando**: Quiser ver um exemplo real funcionando

### 3. **MobileLayoutPresets.tsx**
   - 📍 `app/components/MobileLayoutPresets.tsx`
   - **Conteúdo**: Layouts prontos para copiar e colar
   - **Componentes**:
     - `MobileRootLayout` - Layout raiz com meta tags
     - `MobileContainer` - Container simples
     - `MobilePage` - Página com header/footer/scroll
     - `ExampleSimplePage()` - Exemplo simples
     - `ExampleWithBottomNav()` - Com navegação
     - `ExampleFormPage()` - Formulário
     - `ExampleListPage()` - Lista com infinite scroll
   - **Use quando**: Quiser copiar um layout pronto e adaptar

### 4. **MOBILE_SETUP_GUIDE.ts**
   - 📍 `app/components/MOBILE_SETUP_GUIDE.ts`
   - **Conteúdo**: Configurações e setup
   - **Inclui**:
     - Configuração Tailwind (`theme.extend`)
     - CSS global necessário
     - Hook `useMobile()` para detecção
     - Constantes `MOBILE_STYLES`
     - Checklist de verificação
     - Tips de performance
     - Ferramentas de testing
   - **Use quando**: Configurar o projeto ou consultar padrões

### 5. **MOBILE_LAYOUT_DOCS.md** ⭐ (LEIA PRIMEIRO)
   - 📍 `MOBILE_LAYOUT_DOCS.md`
   - **Conteúdo**: Documentação completa
   - **Seções**:
     - Setup (meta tags, CSS, Tailwind)
     - Início rápido (3 abordagens)
     - API de componentes
     - Design system (espaçamento, tipografia)
     - Breakpoints
     - Safe areas
     - Evitar comum (scroll horizontal, etc)
     - Performance
     - Testes
     - Exemplos práticos
     - Checklist final
   - **Use quando**: Precisa de documentação completa

### 6. **MOBILE_QUICK_REFERENCE.tsx**
   - 📍 `MOBILE_QUICK_REFERENCE.tsx`
   - **Conteúdo**: Guia rápido com copy-paste
   - **Inclui**:
     - Estrutura básica
     - Página simples
     - Página com nav
     - Componentes copy-paste (cards, buttons, inputs)
     - Responsividade
     - Estado
     - Formulários
     - Listas com scroll
     - Dicas de performance
     - Testes
   - **Use quando**: Precisa de um snippet rápido

### 7. **Esse arquivo** 📖
   - 📍 `MOBILE_LAYOUT_INDEX.md`
   - Índice e guia de navegação

---

## 🚀 Como Começar (3 passos)

### Passo 1: Escolha sua abordagem

#### A) Copiar um exemplo pronto (mais rápido)
```tsx
// Copie de MOBILE_QUICK_REFERENCE.tsx
// ou MobileLayoutPresets.tsx
```

#### B) Usar componentes individuais (mais flexível)
```tsx
import { MobileAppLayout, MobileHeader } from '@/components/MobileAppLayout';
```

#### C) Estender exemplo completo (mais rico)
```tsx
import MobileAppExample from '@/components/MobileAppExample';
```

### Passo 2: Adicione meta tags

Copie de `MOBILE_LAYOUT_DOCS.md` → Seção "Meta Tags Críticas"

### Passo 3: Importe e adapte

```tsx
'use client';
import { MobilePage } from '@/components/MobileLayoutPresets';

export default function Home() {
  return (
    <MobilePage header={<h1>Título</h1>}>
      {/* Seu conteúdo */}
    </MobilePage>
  );
}
```

---

## 📋 Guia Rápido por Tarefa

### "Preciso criar uma home page"
→ Veja: `MOBILE_QUICK_REFERENCE.tsx` - Seção 1 + 2

### "Como fazer um formulário?"
→ Veja: `MOBILE_QUICK_REFERENCE.tsx` - Seção 7

### "Como fazer navegação com abas?"
→ Veja: `MobileAppExample.tsx` ou `MOBILE_QUICK_REFERENCE.tsx` - Seção 3

### "Como configurar o projeto?"
→ Veja: `MOBILE_LAYOUT_DOCS.md` - Seção "Checklist de Configuração"

### "Como usar cada componente?"
→ Veja: `MOBILE_LAYOUT_DOCS.md` - Seção "Componentes Disponíveis"

### "Como fazer responsividade?"
→ Veja: `MOBILE_LAYOUT_DOCS.md` - Seção "Breakpoints"

### "Quais breakpoints usar?"
→ Veja: `MOBILE_SETUP_GUIDE.ts` - Seção "tailwind.config.ts"

### "Como testar no mobile?"
→ Veja: `MOBILE_LAYOUT_DOCS.md` - Seção "Testar Responsividade"

### "O que não devo fazer?"
→ Veja: `MOBILE_LAYOUT_DOCS.md` - Seção "Evitar Comum"

### "Tenho dúvida técnica específica"
→ Veja: `MOBILE_SETUP_GUIDE.ts` - Relevante à sua dúvida

---

## 🎯 Estrutura de Componentes

```
MobileAppLayout (container com header/footer)
├── MobileHeader (cabeçalho compacto)
├── [Conteúdo com scroll]
└── MobileBottomNav (navegação inferior)

MobileContent (padding consistente)
├── MobileCard (componente reutilizável)
├── MobileButton (botão acessível)
└── MobileInput (campo de entrada)

MobilePage (layout completo, pronto)
├── Header
├── Main (com scroll)
└── Footer
```

---

## 🔑 Pontos-Chave

| Requisito | Como Fazer | Onde Consultar |
|-----------|-----------|-----------------|
| Viewport | Meta viewport | MOBILE_LAYOUT_DOCS.md |
| Safe areas | Classe `.safe-area-*` | MOBILE_SETUP_GUIDE.ts |
| Altura de toque | `min-h-[44px]` | MOBILE_QUICK_REFERENCE.tsx |
| Sem scroll horizontal | `w-full max-w-full` | MOBILE_LAYOUT_DOCS.md |
| Padding | `px-4 py-3` padrão | MOBILE_SETUP_GUIDE.ts |
| Tipografia | `text-base` = 16px | MOBILE_QUICK_REFERENCE.tsx |
| Breakpoints | `sm:`, `md:`, `lg:` | MOBILE_SETUP_GUIDE.ts |
| Feedback toque | `active:` não `hover:` | MOBILE_QUICK_REFERENCE.tsx |

---

## 🎨 Padrão de Espaçamento

```
Todos os valores em múltiplos de 4px (Tailwind default):

8px   = gap-2, p-2
16px  = gap-4, p-4  ← Padrão
24px  = gap-6, p-6
32px  = gap-8, p-8
```

---

## ✅ Checklist de Uso

Ao criar uma página mobile:

- [ ] Usar `MobilePage` ou `MobileAppLayout`
- [ ] Header fixo com `safe-area-top`
- [ ] Conteúdo em `MobileContent`
- [ ] Botões com `min-h-[44px]`
- [ ] Inputs com `text-base` (16px)
- [ ] Padding lateral `px-4` ou `px-6`
- [ ] Sem scroll horizontal (`w-full max-w-full`)
- [ ] Feedback ao toque (`active:` em vez de `hover:`)
- [ ] Testar em `sm:` (640px) e maior
- [ ] Testar em dispositivo real

---

## 📱 Dispositivos Testados

- ✅ iPhone 14 (390px)
- ✅ iPhone SE (375px)
- ✅ Galaxy S21 (360px)
- ✅ iPad (768px)
- ✅ Desktop (1024px+)

---

## 🔗 Links Rápidos

- **Iniciar**: `MOBILE_LAYOUT_DOCS.md` (seção "Início Rápido")
- **Copiar**: `MOBILE_QUICK_REFERENCE.tsx`
- **Exemplos**: `MobileAppExample.tsx`
- **API**: `MOBILE_LAYOUT_DOCS.md` (seção "Componentes Disponíveis")
- **Setup**: `MOBILE_SETUP_GUIDE.ts`

---

## 💡 Dicas

1. **Comece pelo mobile** - Mobile-first, não desktop adaptado
2. **Use `sm:` para tablet** - Breakpoint principal
3. **Evite hover** - Toque não tem hover
4. **Teste real** - DevTools simula, dispositivo real valida
5. **44px é mágico** - Altura mínima de toque iOS/Android

---

## ❓ FAQ

**P: Por que 44px?**  
R: Apple e Google recomendam como altura mínima para dedos

**P: Qual breakpoint usar?**  
R: `sm` (640px) é o principal, muda de phone para tablet

**P: Posso usar hover?**  
R: Não em mobile. Use `active:` para feedback ao toque

**P: Como testar no mobile?**  
R: DevTools (F12) → Toggle device, ou dispositivo real + ngrok

**P: Qual é o CSS crítico?**  
R: Meta viewport + safe areas + overflow hidden no body

---

**Última atualização**: Abril 2025  
**Mantido por**: Claude Haiku 4.5  
**Versão**: 1.0

---

**Próximo passo**: Abra `MOBILE_LAYOUT_DOCS.md` e siga o "Início Rápido" 🚀

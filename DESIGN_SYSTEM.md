# 🎨 Design System & Component Library

Documentação completa do novo design system com temas, componentes reutilizáveis e skeleton loaders.

## 📋 Índice

1. [Theme System](#theme-system)
2. [Reusable Components](#reusable-components)
3. [Skeleton Loaders](#skeleton-loaders)
4. [Utilities](#utilities)

---

## 🌈 Theme System

### Dark Mode (Default) & Light Mode

O sistema suporta temas **dark** (padrão) e **light**, com fallback automático para preferência do sistema.

### Como Usar

```tsx
'use client';
import { useTheme } from '@/lib/useTheme';
import ThemeToggle from '@/components/ThemeToggle';

export default function MyComponent() {
  const { theme, toggleTheme } = useTheme();

  return (
    <div>
      <ThemeToggle />
      <p>Tema atual: {theme}</p>
      <button onClick={toggleTheme}>Alternar Tema</button>
    </div>
  );
}
```

### Temas Disponíveis

| Tema | Descrição |
|------|-----------|
| `'light'` | Tema claro (fundo branco) |
| `'dark'` | Tema escuro (fundo preto) - padrão |
| `'system'` | Segue preferência do SO |

### Implementação HTML

A seleção de tema é armazenada em:
```html
<html data-theme="dark">
  <!-- ou -->
  <html data-theme="light">
  <!-- ou nenhum atributo para 'system' -->
</html>
```

---

## 🧩 Reusable Components

### Buttons

```tsx
<button className="btn">Default</button>
<button className="btn primary">Primary</button>
<button className="btn secondary">Secondary</button>
<button className="btn danger">Danger</button>
<button className="btn ghost">Ghost</button>

<!-- Sizes -->
<button className="btn sm">Small</button>
<button className="btn lg">Large</button>

<!-- Icon Button -->
<button className="btn icon">+</button>
```

### Inputs & Selects

```tsx
<input className="input" placeholder="Digite aqui..." />
<select className="select">
  <option>Opção 1</option>
</select>
```

### Badges

```tsx
<span className="badge">Default</span>
<span className="badge success">Success</span>
<span className="badge warning">Warning</span>
<span className="badge danger">Danger</span>
<span className="badge neutral">Neutral</span>
```

### Cards

```tsx
<div className="card">
  <div className="card-header">
    <h3 className="card-title">Título</h3>
  </div>
  <div className="card-body">
    <p>Conteúdo do card</p>
  </div>
  <div className="card-footer">
    <button className="btn primary">Ação</button>
  </div>
</div>
```

### Alerts

```tsx
<div className="alert info">
  <div className="alert-icon">ℹ️</div>
  <div className="alert-content">
    <div className="alert-title">Informação</div>
    <div className="alert-message">Mensagem informativa</div>
  </div>
</div>

<div className="alert success">✓ Sucesso!</div>
<div className="alert warning">⚠ Atenção!</div>
<div className="alert error">✗ Erro!</div>
```

---

## 💀 Skeleton Loaders

Para estados de carregamento, use componentes skeleton pré-built:

### Skeleton Components

```tsx
import {
  SkeletonMessageBubble,
  SkeletonTokenPanel,
  SkeletonCard,
  SkeletonChatMessage,
} from '@/components/SkeletonLoaders';

// Uso com Suspense
import { Suspense } from 'react';

export default function Chat() {
  return (
    <Suspense fallback={<SkeletonChatMessage />}>
      <YourAsyncChatComponent />
    </Suspense>
  );
}
```

### CSS Classes Skeleton

Para criar skeletons customizados:

```tsx
<div className="skeleton skeleton-text" />
<div className="skeleton skeleton-text-lg" />
<div className="skeleton skeleton-title" />
<div className="skeleton skeleton-avatar" />
<div className="skeleton skeleton-card" />
<div className="skeleton skeleton-btn" />
<div className="skeleton skeleton-input" />

<!-- Linhas múltiplas -->
<div className="skeleton-lines">
  <div className="skeleton skeleton-line-full" />
  <div className="skeleton skeleton-line-full" />
  <div className="skeleton skeleton-line-partial" />
</div>
```

### Estados de Carregamento

```tsx
<div className="is-loading">
  <div>Seu conteúdo aqui</div>
  <div className="loading-overlay">
    <div className="loading-spinner"></div>
  </div>
</div>
```

---

## 🛠️ Utilities

### Text Utilities

```tsx
<p className="text-sm">Pequeno</p>
<p className="text-md">Médio</p>
<p className="text-lg">Grande</p>

<p className="text-muted">Mutado</p>
<p className="text-accent">Destaque</p>
<p className="text-success">Sucesso</p>
<p className="text-warning">Aviso</p>
<p className="text-danger">Erro</p>

<code className="font-mono">codigo_aqui()</code>
<p className="font-serif">Texto em serif</p>
```

### Spacing

```tsx
<div className="mt-sm">Margem superior pequena</div>
<div className="mb-lg">Margem inferior grande</div>
<div className="gap-md">Gap médio (flex container)</div>
```

### Flex

```tsx
<div className="flex">Flex row</div>
<div className="flex-col">Flex column</div>
<div className="flex-center">Centralizado</div>
<div className="flex-between">Espaçado</div>
<div className="flex-wrap">Com wrap</div>
```

### Grid

```tsx
<div className="grid grid-2">
  <div>Coluna 1</div>
  <div>Coluna 2</div>
</div>

<div className="grid grid-3">
  <div>Col 1</div>
  <div>Col 2</div>
  <div>Col 3</div>
</div>
```

### Responsive

```tsx
<div className="hide-mobile">Apenas desktop</div>
<div className="show-mobile">Apenas mobile</div>
```

---

## 🎯 Design Tokens (CSS Variables)

### Colors

```css
--bg              /* Background principal */
--sidebar         /* Background da sidebar */
--panel           /* Panel/card background */
--text            /* Texto principal */
--muted           /* Texto mutado */
--accent          /* Cor destaque (verde) */
--accent-soft     /* Destaque suave */

--cost-success    /* Verde (sucesso) */
--cost-warning    /* Laranja (aviso) */
--cost-danger     /* Vermelho (erro) */
```

### Spacing

```css
--gap-xs: 4px
--gap-sm: 8px
--gap-md: 12px
--gap-lg: 16px
--gap-xl: 24px
--gap-2xl: 32px
```

### Border Radius

```css
--border-radius-xs: 6px
--border-radius-sm: 8px
--border-radius-md: 12px
--border-radius-lg: 16px
```

### Shadows

```css
--shadow-xs       /* Sombra pequena */
--shadow-soft     /* Sombra suave */
--shadow          /* Sombra padrão */
```

---

## 📝 Exemplo Completo

```tsx
'use client';

import { Suspense } from 'react';
import ThemeToggle from '@/components/ThemeToggle';
import { SkeletonCard } from '@/components/SkeletonLoaders';

export default function Dashboard() {
  return (
    <div className="flex-col gap-lg">
      {/* Theme Toggle */}
      <div className="flex-between">
        <h1 className="text-lg font-serif">Dashboard</h1>
        <ThemeToggle />
      </div>

      {/* Alert */}
      <div className="alert info">
        <div className="alert-icon">ℹ️</div>
        <div className="alert-content">
          <div className="alert-title">Bem-vindo</div>
          <div className="alert-message">Novo design system ativo</div>
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-2">
        <Suspense fallback={<SkeletonCard />}>
          <div className="card">
            <div className="card-header">
              <h2 className="card-title">Card 1</h2>
            </div>
            <div className="card-body">
              <p>Conteúdo aqui</p>
            </div>
            <div className="card-footer">
              <button className="btn primary">Ação</button>
            </div>
          </div>
        </Suspense>

        <div className="card">
          <div className="card-header">
            <h2 className="card-title">Badges</h2>
          </div>
          <div className="card-body flex-wrap gap-sm">
            <span className="badge success">Ativo</span>
            <span className="badge warning">Aviso</span>
            <span className="badge danger">Erro</span>
          </div>
        </div>
      </div>

      {/* Buttons */}
      <div className="flex gap-md">
        <button className="btn primary">Primário</button>
        <button className="btn secondary">Secundário</button>
        <button className="btn danger">Perigo</button>
      </div>
    </div>
  );
}
```

---

## 🚀 Quick Reference

| Feature | File | Usage |
|---------|------|-------|
| Temas | `globals.css` | `data-theme` / `useTheme()` |
| Componentes | `styles/components.css` | Classes `.btn`, `.card`, etc |
| Skeleton | `components/SkeletonLoaders.tsx` | `<Suspense fallback>` |
| Theme Hook | `lib/useTheme.ts` | `const { theme } = useTheme()` |
| Toggle UI | `components/ThemeToggle.tsx` | Incluir na navbar/topbar |

---

**✨ Sistema completo, pronto para produção!**

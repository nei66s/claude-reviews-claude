# 📱 Layout Mobile-First Responsivo

> **Aplicativo nativo iOS/Android com React + Tailwind CSS**

---

## 🎯 O Que Você Recebeu

Um conjunto completo de componentes e layouts otimizados para mobile, seguindo as melhores práticas de UX nativa.

### Arquivos Criados

| Arquivo | Propósito |
|---------|-----------|
| `MobileAppLayout.tsx` | Componentes base (Layout, Header, Nav, Card, Button, Input) |
| `MobileAppExample.tsx` | Exemplo completo funcional com navegação |
| `MobileLayoutPresets.tsx` | Layouts prontos para copiar e colar |
| `MOBILE_SETUP_GUIDE.ts` | Configurações Tailwind, CSS global, hooks |
| `MOBILE_LAYOUT_DOCS.md` | Esta documentação |

---

## 📋 Checklist de Configuração

### 1️⃣ Meta Tags Críticas

Adicione ao seu `app/layout.tsx` (raiz):

```tsx
<head>
  <meta charset="utf-8" />
  <meta 
    name="viewport" 
    content="width=device-width, initial-scale=1, viewport-fit=cover" 
  />
  <meta name="theme-color" content="#ffffff" />
  <meta name="apple-mobile-web-app-capable" content="yes" />
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
  <meta name="format-detection" content="telephone=no" />
</head>
```

### 2️⃣ CSS Global (app/globals.css)

```css
html, body {
  width: 100%;
  height: 100vh;
  margin: 0;
  padding: 0;
  overflow: hidden;
  -webkit-font-smoothing: antialiased;
  -webkit-text-size-adjust: 100%;
}

/* Safe areas para notch */
@supports (padding: max(0px)) {
  .safe-area-top {
    padding-top: max(0px, env(safe-area-inset-top));
  }
  .safe-area-bottom {
    padding-bottom: max(0px, env(safe-area-inset-bottom));
  }
}

/* Smooth scroll iOS */
.mobile-scroll {
  -webkit-overflow-scrolling: touch;
}

/* Sem tap highlight */
button, a {
  -webkit-tap-highlight-color: transparent;
}

/* Input sem zoom em iOS */
input, textarea {
  font-size: 16px;
}
```

### 3️⃣ Tailwind Config (tailwind.config.ts)

```typescript
import type { Config } from 'tailwindcss'

const config: Config = {
  theme: {
    extend: {
      screens: {
        xs: '320px',   // Small phone
        sm: '640px',   // Tablet
        md: '768px',   // iPad
        lg: '1024px',  // Desktop
      },
      minHeight: {
        touch: '44px', // iOS/Android touch target
      },
    },
  },
}

export default config
```

---

## 🚀 Início Rápido

### Opção 1: Usar Componentes Individuais

```tsx
import {
  MobileAppLayout,
  MobileHeader,
  MobileContent,
  MobileButton,
} from '@/components/MobileAppLayout';

export default function Home() {
  return (
    <MobileAppLayout
      header={<MobileHeader title="Home" />}
    >
      <MobileContent padding="normal">
        <h1>Bem-vindo!</h1>
        <MobileButton>Clique aqui</MobileButton>
      </MobileContent>
    </MobileAppLayout>
  );
}
```

### Opção 2: Usar Layout Pronto

```tsx
import { MobilePage } from '@/components/MobileLayoutPresets';

export default function Home() {
  return (
    <MobilePage
      header={
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Título</h1>
        </div>
      }
    >
      {/* Seu conteúdo aqui */}
    </MobilePage>
  );
}
```

### Opção 3: Copiar Exemplo Completo

Veja `MobileAppExample.tsx` para um app funcional completo com:
- ✅ Navegação inferior
- ✅ Múltiplas telas
- ✅ Formulários
- ✅ Lista de items

---

## 📱 Componentes Disponíveis

### MobileAppLayout

Container principal com header e footer fixos.

```tsx
<MobileAppLayout
  header={<YourHeader />}
  footer={<YourFooter />}
  hasBottomNav={true}
  headerFixed={true}
>
  {children}
</MobileAppLayout>
```

**Props:**
- `header?: ReactNode` - Header fixo no topo
- `footer?: ReactNode` - Footer fixo no rodapé
- `children: ReactNode` - Conteúdo com scroll
- `hasBottomNav?: boolean` - Adiciona padding para evitar sobreposição
- `headerFixed?: boolean` - Header sticky

---

### MobileHeader

Header compacto com título e ações.

```tsx
<MobileHeader
  title="Página"
  subtitle="Subtítulo"
  leftAction={<IconMenu />}
  rightAction={<IconUser />}
/>
```

**Props:**
- `title?: string` - Título principal
- `subtitle?: string` - Subtítulo
- `leftAction?: ReactNode` - Ícone/botão esquerda
- `rightAction?: ReactNode` - Ícone/botão direita

---

### MobileBottomNav

Navegação inferior com ícone + label (iOS/Android style).

```tsx
<MobileBottomNav
  items={[
    { icon: <Home />, label: 'Home', active: true },
    { icon: <Search />, label: 'Buscar', active: false },
    { icon: <User />, label: 'Perfil', active: false },
  ]}
  onItemClick={(index) => console.log(index)}
/>
```

**Props:**
- `items: NavItem[]` - Array de itens com `{ icon, label, active }`
- `onItemClick?: (index: number) => void` - Callback ao clicar

---

### MobileContent

Container com padding consistente e sem overflow.

```tsx
<MobileContent padding="normal">
  {/* Seu conteúdo */}
</MobileContent>
```

**Padding Options:**
- `tight` → `px-3 py-2` (inputs/formulários)
- `normal` → `px-4 py-3` (conteúdo padrão)
- `loose` → `px-4 py-4` (seções principais)

---

### MobileCard

Card com feedback ao toque.

```tsx
<MobileCard interactive onClick={() => {}}>
  <h3>Título</h3>
  <p>Conteúdo</p>
</MobileCard>
```

**Props:**
- `interactive?: boolean` - Ativa visual de toque
- `padding?: boolean` - Aplica padding interno
- `onClick?: () => void` - Callback

---

### MobileButton

Botão acessível com altura 44px.

```tsx
<MobileButton 
  variant="primary" 
  fullWidth={true}
  disabled={false}
>
  Clique aqui
</MobileButton>
```

**Variantes:**
- `primary` → Azul, ação principal
- `secondary` → Cinza, ação secundária
- `ghost` → Transparente, link

---

### MobileInput

Campo de entrada otimizado para toque.

```tsx
<MobileInput
  placeholder="Digite..."
  value={value}
  onChange={setValue}
  icon={<IconSearch />}
  type="email"
/>
```

**Props:**
- `placeholder?: string` - Texto sugestivo
- `icon?: ReactNode` - Ícone à esquerda
- `type?: string` - Tipo HTML (email, tel, etc)
- `fullWidth?: boolean` - Ocupa 100%

---

## 🎨 Design System

### Espaçamento (Tailwind)

Múltiplos de 4px (recomendação Google Material):

```
8px   = gap-2, p-2, m-2
16px  = gap-4, p-4, m-4 ← Padrão
24px  = gap-6, p-6, m-6
32px  = gap-8, p-8, m-8
```

### Tipografia (Mobile-First)

```
12px → text-xs    (Labels)
14px → text-sm    (Subtexto)
16px → text-base  (Corpo)
18px → text-lg    (Heading pequeno)
20px → text-xl    (Heading)
24px → text-2xl   (Heading grande)
```

### Cores

```
primary   → blue-600
secondary → gray-600
success   → green-600
danger    → red-600
```

### Altura Acessível

Todo elemento clicável deve ter **mínimo 44px × 44px**:

```tsx
// ✅ Bom
<button className="min-h-[44px]">Clique</button>

// ❌ Ruim
<button className="h-8">Clique</button>
```

---

## 📐 Breakpoints

Mobile-first, progressivo:

```
Mobile  → 0-639px    (Default)
sm      → 640px+     (Tablet)
md      → 768px+     (iPad)
lg      → 1024px+    (Desktop)
xl      → 1280px+    (Desktop grande)
```

**Uso:**

```tsx
// Padrão mobile, muda em sm
<div className="px-4 sm:px-6">
  {/* 16px mobile, 24px tablet+ */}
</div>

// Stack vertical mobile, grid em md
<div className="flex flex-col md:grid md:grid-cols-2">
  {/* Empilhado mobile, 2 colunas desktop */}
</div>
```

---

## 🛡️ Safe Areas (iPhone Notch/Dynamic Island)

Aplica automaticamente padding para notch:

```tsx
// Classe que aplica safe-area automaticamente
<header className="safe-area-top safe-area-left safe-area-right">
  {/* Conteúdo respeitará o notch */}
</header>
```

**CSS (já incluído):**

```css
@supports (padding: max(0px)) {
  .safe-area-top {
    padding-top: max(0px, env(safe-area-inset-top));
  }
}
```

---

## 🚫 Evitar Comum

### ❌ Scroll Horizontal

```tsx
// ERRADO - pode ter overflow
<div className="w-screen">...</div>

// CORRETO - sempre 100%, max 100%
<div className="w-full max-w-full">...</div>
```

### ❌ Elementos que Pulam

```tsx
// ERRADO - Layout shift
<div style={{ height: loading ? 'auto' : 0 }}>...</div>

// CORRETO - Altura fixa ou skeleton
<div className="min-h-[100px]">...</div>
```

### ❌ Inputs Pequenos

```tsx
// ERRADO - Difícil de tocar
<input className="h-6 px-1" />

// CORRETO - 44px mínimo
<input className="min-h-[44px] px-4" />
```

### ❌ Hover em Mobile

```tsx
// ERRADO - Hover não funciona no touch
<button className="hover:bg-blue-700">Clique</button>

// CORRETO - Use active para feedback
<button className="active:bg-blue-700">Clique</button>
```

### ❌ Fonte Pequena em Input

```tsx
// ERRADO - Causa zoom automático em iOS < 16px
<input style={{ fontSize: '14px' }} />

// CORRETO - Sempre 16px+
<input className="text-base" /> {/* 16px */}
```

---

## ⚡ Performance

### Carregamento Rápido

```tsx
// ✅ Code splitting
const HeavyComponent = dynamic(() => import('./Heavy'), {
  loading: () => <Skeleton />,
  ssr: false,
});

// ✅ Lazy load images
<Image loading="lazy" alt="..." />

// ✅ Evitar reflow
<div className="transform transition-transform">
  {/* Use transform em vez de width/height */}
</div>
```

### Smooth Scroll iOS

```css
.mobile-scroll {
  -webkit-overflow-scrolling: touch;
}
```

---

## 🧪 Testar Responsividade

### Tamanhos Recomendados

| Dispositivo | Resolução | Aspect |
|------------|-----------|---------|
| iPhone SE | 375×667 | 16:9 |
| iPhone 14 | 390×844 | 9:19.5 |
| Galaxy S21 | 360×800 | 18:9 |
| iPad Mini | 768×1024 | 4:3 |

### DevTools

```bash
# Chrome
1. F12 → Toggle Device Toolbar (Ctrl+Shift+M)
2. Selecione iPhone 14 Pro / Galaxy S21
3. Teste scroll, botões, inputs

# Firefox
1. Ctrl+Shift+M → Responsive Design Mode
2. Selecione altura/largura

# Safari
1. Develop → Enter Responsive Design Mode
2. Selecione preset

# Teste real
1. ngrok http 3000
2. Abra no dispositivo real
```

---

## 🎯 Exemplos Práticos

### Exemplo 1: Home com Grid

```tsx
import { MobilePage, MobileContent, MobileCard } from '@/components/MobileLayoutPresets';

export default function Home() {
  return (
    <MobilePage header={<h1 className="text-lg font-semibold p-4">Home</h1>}>
      <MobileContent>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {[1, 2, 3, 4].map((item) => (
            <MobileCard key={item} interactive>
              <div className="aspect-square flex items-center justify-center bg-blue-100 rounded">
                {item}
              </div>
            </MobileCard>
          ))}
        </div>
      </MobileContent>
    </MobilePage>
  );
}
```

### Exemplo 2: Formulário

```tsx
export default function Form() {
  const [form, setForm] = useState({ name: '', email: '' });

  return (
    <MobilePage header={<h1 className="text-lg font-semibold p-4">Contato</h1>}>
      <MobileContent>
        <form className="space-y-4">
          <input
            type="text"
            placeholder="Nome"
            className="w-full min-h-[44px] px-4 border rounded-lg"
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <button type="submit" className="w-full min-h-[44px] bg-blue-600 text-white rounded-lg font-semibold">
            Enviar
          </button>
        </form>
      </MobileContent>
    </MobilePage>
  );
}
```

---

## 📚 Recursos

- [Next.js Image Optimization](https://nextjs.org/docs/basic-features/image-optimization)
- [Web.dev Mobile Optimization](https://web.dev/mobile/)
- [Apple Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Google Material Design](https://material.io/design)
- [Tailwind CSS Docs](https://tailwindcss.com/docs)

---

## ✅ Checklist Final

- [ ] Meta tags viewport adicionadas
- [ ] CSS global importado
- [ ] Safe areas configuradas
- [ ] Componentes importados corretamente
- [ ] Padding lateral 16-20px
- [ ] Buttons com altura 44px+
- [ ] Sem scroll horizontal
- [ ] Inputs com font-size 16px
- [ ] Testado em iPhone + Android
- [ ] Scroll suave funcionando
- [ ] BottomNav fixo e acessível
- [ ] Performance > 90 (Lighthouse)

---

**Criado**: Abril 2025 | **Stack**: React 18 + Next.js 14 + Tailwind CSS 3

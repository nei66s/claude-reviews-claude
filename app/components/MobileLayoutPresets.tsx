/**
 * Layout Mobile para Uso Imediato
 * Copiar e adaptar conforme necessário
 */

import React, { ReactNode } from 'react';

/**
 * ROOT LAYOUT - Envolva toda a aplicação com isso
 * Use em: app/layout.tsx (raiz) ou app/(mobile)/layout.tsx (rota específica)
 */
export const MobileRootLayout = ({ children }: { children: ReactNode }) => {
  return (
    <html lang="pt-BR">
      <head>
        {/* Meta tags críticas para mobile */}
        <meta charSet="utf-8" />
        <meta 
          name="viewport" 
          content="width=device-width, initial-scale=1, viewport-fit=cover, minimum-scale=1, maximum-scale=5, user-scalable=yes" 
        />
        <meta name="theme-color" content="#ffffff" />
        
        {/* Apple specific */}
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="App" />
        
        {/* Android */}
        <meta name="mobile-web-app-capable" content="yes" />
        
        {/* Desabilitar zoom em inputs (opcional) */}
        <meta name="format-detection" content="telephone=no" />
        
        {/* Estilos inline críticos para evitar layout shift */}
        <style>{`
          html,
          body {
            margin: 0;
            padding: 0;
            width: 100%;
            height: 100vh;
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
            -webkit-text-size-adjust: 100%;
            overflow: hidden;
          }

          @supports (padding: max(0px)) {
            .safe-area-top {
              padding-top: max(0px, env(safe-area-inset-top));
            }
            .safe-area-bottom {
              padding-bottom: max(0px, env(safe-area-inset-bottom));
            }
            .safe-area-left {
              padding-left: max(0px, env(safe-area-inset-left));
            }
            .safe-area-right {
              padding-right: max(0px, env(safe-area-inset-right));
            }
          }

          /* Smooth scroll iOS */
          .mobile-scroll {
            -webkit-overflow-scrolling: touch;
          }

          /* Remove tap highlight */
          button,
          a {
            -webkit-tap-highlight-color: transparent;
            -webkit-touch-callout: none;
          }

          /* Fix input zoom em iOS */
          input,
          textarea,
          select {
            font-size: 16px;
          }
        `}</style>
      </head>
      <body>
        <div className="flex flex-col w-screen h-screen overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
};

/**
 * MOBILE CONTAINER - Padrão básico
 */
export const MobileContainer = ({ 
  children, 
  className = '' 
}: { 
  children: ReactNode; 
  className?: string;
}) => {
  return (
    <div className={`flex flex-col w-full h-screen overflow-hidden ${className}`}>
      {children}
    </div>
  );
};

/**
 * MOBILE PAGE - Para páginas individuais
 */
interface MobilePageProps {
  header?: ReactNode;
  footer?: ReactNode;
  children: ReactNode;
  scrollable?: boolean;
  hasBottomPadding?: boolean;
}

export const MobilePage: React.FC<MobilePageProps> = ({
  header,
  footer,
  children,
  scrollable = true,
  hasBottomPadding = true,
}) => {
  return (
    <MobileContainer>
      {/* Header fixo */}
      {header && (
        <header className="sticky top-0 z-40 bg-white border-b border-gray-200 safe-area-top safe-area-left safe-area-right">
          {header}
        </header>
      )}

      {/* Conteúdo com scroll */}
      <main
        className={`flex-1 ${scrollable ? 'overflow-y-auto overflow-x-hidden mobile-scroll' : 'overflow-hidden'} ${
          hasBottomPadding ? 'pb-24 sm:pb-0' : ''
        }`}
      >
        {children}
      </main>

      {/* Footer fixo */}
      {footer && (
        <footer className="fixed sm:static bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-200 safe-area-bottom safe-area-left safe-area-right">
          {footer}
        </footer>
      )}
    </MobileContainer>
  );
};

/**
 * Exemplos de uso pronto para copiar:
 */

// ============================================
// EXEMPLO 1: Página simples com header
// ============================================
export function ExampleSimplePage() {
  return (
    <MobilePage
      header={
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Home</h1>
        </div>
      }
    >
      <div className="px-4 py-4">
        <h2 className="text-base font-medium mb-4">Conteúdo</h2>
        <p className="text-sm text-gray-600">Seu conteúdo aqui</p>
      </div>
    </MobilePage>
  );
}

// ============================================
// EXEMPLO 2: Página com header e bottom nav
// ============================================
export function ExampleWithBottomNav() {
  return (
    <MobilePage
      header={
        <div className="px-4 py-3 flex items-center justify-between">
          <h1 className="text-lg font-semibold">App</h1>
          <button className="w-10 h-10 flex items-center justify-center">⚙️</button>
        </div>
      }
      footer={
        <nav className="flex items-center justify-around">
          <button className="flex-1 py-3 flex flex-col items-center justify-center gap-1">
            <span className="text-xl">🏠</span>
            <span className="text-xs">Home</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center justify-center gap-1">
            <span className="text-xl">🔍</span>
            <span className="text-xs">Buscar</span>
          </button>
          <button className="flex-1 py-3 flex flex-col items-center justify-center gap-1">
            <span className="text-xl">👤</span>
            <span className="text-xs">Perfil</span>
          </button>
        </nav>
      }
    >
      <div className="px-4 py-4">
        <div className="bg-blue-50 rounded-lg p-4 mb-4">
          <h2 className="text-base font-semibold text-blue-900 mb-2">Bem-vindo!</h2>
          <p className="text-sm text-blue-700">Este é um app mobile-first</p>
        </div>

        <div className="space-y-3">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-white border border-gray-200 rounded-lg p-4">
              <p className="text-sm font-medium text-gray-900">Item {item}</p>
              <p className="text-xs text-gray-500 mt-1">Descrição do item</p>
            </div>
          ))}
        </div>
      </div>
    </MobilePage>
  );
}

// ============================================
// EXEMPLO 3: Formulário mobile
// ============================================
export function ExampleFormPage() {
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    message: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted:', formData);
  };

  return (
    <MobilePage
      header={
        <div className="px-4 py-3">
          <button className="text-blue-600 text-sm font-medium">&larr; Voltar</button>
          <h1 className="text-lg font-semibold mt-2">Contato</h1>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="px-4 py-4 space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Nome
          </label>
          <input
            type="text"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Digite seu nome"
            className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email
          </label>
          <input
            type="email"
            value={formData.email}
            onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            placeholder="seu@email.com"
            className="w-full min-h-[44px] px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Mensagem
          </label>
          <textarea
            value={formData.message}
            onChange={(e) => setFormData({ ...formData, message: e.target.value })}
            placeholder="Digite sua mensagem"
            rows={5}
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            className="flex-1 min-h-[44px] px-4 py-3 bg-gray-200 text-gray-900 rounded-lg font-medium active:bg-gray-300 transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="flex-1 min-h-[44px] px-4 py-3 bg-blue-600 text-white rounded-lg font-medium active:bg-blue-700 transition-colors"
          >
            Enviar
          </button>
        </div>
      </form>
    </MobilePage>
  );
}

// ============================================
// EXEMPLO 4: Lista com infinite scroll
// ============================================
export function ExampleListPage() {
  const [items, setItems] = React.useState(
    Array.from({ length: 10 }, (_, i) => ({ id: i, title: `Item ${i + 1}` }))
  );
  const [loading, setLoading] = React.useState(false);

  const loadMore = () => {
    setLoading(true);
    setTimeout(() => {
      const newItems = Array.from({ length: 10 }, (_, i) => ({
        id: items.length + i,
        title: `Item ${items.length + i + 1}`,
      }));
      setItems([...items, ...newItems]);
      setLoading(false);
    }, 500);
  };

  React.useEffect(() => {
    const handleScroll = (e: Event) => {
      const target = e.target as HTMLElement;
      if (target.scrollHeight - target.scrollTop === target.clientHeight && !loading) {
        loadMore();
      }
    };

    const mainElement = document.querySelector('main');
    mainElement?.addEventListener('scroll', handleScroll);
    return () => mainElement?.removeEventListener('scroll', handleScroll);
  }, [loading]);

  return (
    <MobilePage
      header={
        <div className="px-4 py-3">
          <h1 className="text-lg font-semibold">Lista</h1>
        </div>
      }
    >
      <div className="px-4 py-4 space-y-2">
        {items.map((item) => (
          <div key={item.id} className="bg-white border border-gray-200 rounded-lg p-4 active:bg-gray-50">
            <p className="text-sm font-medium text-gray-900">{item.title}</p>
            <p className="text-xs text-gray-500 mt-1">Item ID: {item.id}</p>
          </div>
        ))}

        {loading && (
          <div className="flex justify-center py-4">
            <div className="text-sm text-gray-500">Carregando...</div>
          </div>
        )}
      </div>
    </MobilePage>
  );
}

export default {
  MobileRootLayout,
  MobileContainer,
  MobilePage,
};

/**
 * Mobile-First App Layout
 * Otimizado para iOS e Android com safe areas, responsividade e UX mobile nativa
 */

import React, { ReactNode } from 'react';

interface MobileAppLayoutProps {
  header?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  hasBottomNav?: boolean;
  headerFixed?: boolean;
}

/**
 * Layout principal mobile-first
 * Estrutura: Header (fixo) → Conteúdo (scroll) → BottomNav (fixo)
 */
export const MobileAppLayout: React.FC<MobileAppLayoutProps> = ({
  header,
  children,
  footer,
  hasBottomNav = false,
  headerFixed = true,
}) => {
  return (
    <div className="flex flex-col w-full h-screen bg-white overflow-hidden">
      {/* Safe area top (iPhone notch) */}
      {headerFixed && (
        <style>{`
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
        `}</style>
      )}

      {/* Header - Fixo no topo */}
      {header && (
        <header className={`safe-area-top ${headerFixed ? 'sticky top-0 z-40' : ''} bg-white border-b border-gray-200 shadow-sm`}>
          {header}
        </header>
      )}

      {/* Conteúdo - Com scroll suave */}
      <main
        className={`flex-1 overflow-y-auto overflow-x-hidden ${
          hasBottomNav ? 'pb-20 sm:pb-0' : ''
        }`}
        style={{
          WebkitOverflowScrolling: 'touch', // Smooth scroll iOS
        }}
      >
        {children}
      </main>

      {/* Footer/BottomNav - Fixo no rodapé (mobile) */}
      {footer && (
        <footer className={`safe-area-bottom ${hasBottomNav ? 'fixed sm:static bottom-0 left-0 right-0 z-40' : ''} bg-white border-t border-gray-200`}>
          {footer}
        </footer>
      )}
    </div>
  );
};

/**
 * Header mobile - Compacto e acessível
 */
interface MobileHeaderProps {
  title?: string;
  subtitle?: string;
  leftAction?: ReactNode;
  rightAction?: ReactNode;
}

export const MobileHeader: React.FC<MobileHeaderProps> = ({
  title,
  subtitle,
  leftAction,
  rightAction,
}) => {
  return (
    <div className="px-4 sm:px-6 py-3 safe-area-left safe-area-right">
      <div className="flex items-center justify-between gap-3">
        {/* Left action area */}
        {leftAction && <div className="w-10 flex items-center justify-center">{leftAction}</div>}

        {/* Title section - Flexível */}
        <div className={`flex-1 ${leftAction ? '' : 'text-center'} ${rightAction ? '' : ''}`}>
          {title && <h1 className="text-lg sm:text-xl font-semibold text-gray-900 leading-tight">{title}</h1>}
          {subtitle && <p className="text-xs sm:text-sm text-gray-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Right action area */}
        {rightAction && <div className="w-10 flex items-center justify-center">{rightAction}</div>}
      </div>
    </div>
  );
};

/**
 * Bottom Navigation - Acessível para polegar, fixo em mobile
 */
interface NavItem {
  icon: ReactNode;
  label: string;
  active?: boolean;
  onClick?: () => void;
}

interface MobileBottomNavProps {
  items: NavItem[];
  onItemClick?: (index: number) => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({ items, onItemClick }) => {
  return (
    <nav className="w-full bg-white border-t border-gray-200">
      <div className="flex items-center justify-around safe-area-left safe-area-right">
        {items.map((item, index) => (
          <button
            key={index}
            onClick={() => onItemClick?.(index)}
            className={`flex-1 py-3 px-2 sm:px-4 flex flex-col items-center justify-center gap-1 min-h-[44px] sm:min-h-auto active:bg-gray-50 transition-colors ${
              item.active ? 'text-blue-600' : 'text-gray-600'
            }`}
            aria-label={item.label}
          >
            <div className="w-6 h-6 flex items-center justify-center">{item.icon}</div>
            <span className="text-xs font-medium hidden sm:inline">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
};

/**
 * Content Container - Padding consistente, sem overflow horizontal
 */
interface MobileContentProps {
  children: ReactNode;
  padding?: 'tight' | 'normal' | 'loose';
}

export const MobileContent: React.FC<MobileContentProps> = ({
  children,
  padding = 'normal',
}) => {
  const paddingClasses = {
    tight: 'px-3 py-2 sm:px-4 sm:py-3',
    normal: 'px-4 py-3 sm:px-6 sm:py-4',
    loose: 'px-4 py-4 sm:px-6 sm:py-6',
  };

  return (
    <div className={`w-full max-w-full ${paddingClasses[padding]} safe-area-left safe-area-right`}>
      {children}
    </div>
  );
};

/**
 * Card mobile - Componente visual comum em apps
 */
interface MobileCardProps {
  children: ReactNode;
  onClick?: () => void;
  interactive?: boolean;
  padding?: boolean;
}

export const MobileCard: React.FC<MobileCardProps> = ({
  children,
  onClick,
  interactive = false,
  padding = true,
}) => {
  return (
    <div
      onClick={onClick}
      className={`w-full bg-white border border-gray-200 rounded-lg overflow-hidden ${
        padding ? 'p-4 sm:p-6' : ''
      } ${interactive ? 'active:bg-gray-50 active:border-gray-300 transition-colors cursor-pointer' : ''}`}
    >
      {children}
    </div>
  );
};

/**
 * Button mobile - Acessível com altura mínima de 44px
 */
interface MobileButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  fullWidth?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit' | 'reset';
}

export const MobileButton: React.FC<MobileButtonProps> = ({
  children,
  onClick,
  variant = 'primary',
  fullWidth = true,
  disabled = false,
  type = 'button',
}) => {
  const variantClasses = {
    primary: 'bg-blue-600 text-white active:bg-blue-700',
    secondary: 'bg-gray-200 text-gray-900 active:bg-gray-300',
    ghost: 'bg-transparent text-blue-600 active:bg-blue-50',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`w-${fullWidth ? 'full' : 'auto'} min-h-[44px] px-4 py-3 sm:py-2 rounded-lg font-medium transition-colors active:opacity-80 disabled:opacity-50 disabled:cursor-not-allowed ${variantClasses[variant]}`}
    >
      {children}
    </button>
  );
};

/**
 * Input mobile - Campo grande e acessível
 */
interface MobileInputProps {
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
  type?: string;
  disabled?: boolean;
  icon?: ReactNode;
  fullWidth?: boolean;
}

export const MobileInput: React.FC<MobileInputProps> = ({
  placeholder,
  value,
  onChange,
  type = 'text',
  disabled = false,
  icon,
  fullWidth = true,
}) => {
  return (
    <div className={`w-${fullWidth ? 'full' : 'auto'} relative`}>
      {icon && <div className="absolute left-3 top-3 sm:top-2 text-gray-400 flex items-center justify-center h-5 w-5">{icon}</div>}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        disabled={disabled}
        className={`w-full min-h-[44px] px-${icon ? '10' : '4'} py-3 sm:py-2 border border-gray-300 rounded-lg font-base placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed transition-all`}
      />
    </div>
  );
};

/**
 * Spacing components - Espaçamento consistente
 */
export const MobileSpacing = {
  xs: <div className="h-2 sm:h-1" />,
  sm: <div className="h-4 sm:h-3" />,
  md: <div className="h-6 sm:h-4" />,
  lg: <div className="h-8 sm:h-6" />,
  xl: <div className="h-12 sm:h-8" />,
};

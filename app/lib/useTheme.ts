'use client';

import { ReactNode, useEffect, useState } from 'react';

type Theme = 'dark' | 'light' | 'system';

function readStoredTheme(): Theme {
  if (typeof window === 'undefined') {
    return 'dark';
  }

  const saved = localStorage.getItem('theme');
  return saved === 'dark' || saved === 'light' || saved === 'system' ? saved : 'dark';
}

function applyThemeValue(newTheme: Theme) {
  const html = document.documentElement;

  if (newTheme === 'system') {
    html.removeAttribute('data-theme');
  } else {
    html.setAttribute('data-theme', newTheme);
  }

  localStorage.setItem('theme', newTheme);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>(() => readStoredTheme());
  const mounted = typeof window !== 'undefined';

  useEffect(() => {
    applyThemeValue(theme);
  }, [theme]);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
  };

  const toggleTheme = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const setSystemTheme = () => {
    setTheme('system');
  };

  return {
    theme,
    mounted,
    toggleTheme,
    setSystemTheme,
    setTheme,
  };
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  return children;
}

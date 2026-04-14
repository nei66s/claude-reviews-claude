'use client';

import { useTheme } from '../lib/useTheme';

export default function ThemeToggle() {
  const { theme, mounted, toggleTheme, setSystemTheme } = useTheme();

  if (!mounted) return null;

  return (
    <div className="flex gap-sm">
      <button
        className={`btn sm ${theme === 'dark' ? 'primary' : 'ghost'}`}
        onClick={() => toggleTheme()}
        title="Toggle dark/light theme"
      >
        {theme === 'dark' ? '🌙' : '☀️'} {theme === 'system' ? '' : theme}
      </button>
      {theme !== 'system' && (
        <button
          className="btn sm ghost"
          onClick={setSystemTheme}
          title="Use system preference"
        >
          ⚙️
        </button>
      )}
    </div>
  );
}

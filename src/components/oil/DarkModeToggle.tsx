'use client';

import { useEffect, useState } from 'react';

const STORAGE_KEY = 'oil-dark-mode';

export function useDarkMode() {
  const [isDark, setIsDark] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setIsDark(true);
      document.documentElement.classList.add('dark');
    } else if (stored === null) {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) {
        setIsDark(true);
        document.documentElement.classList.add('dark');
      }
    }
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem(STORAGE_KEY, String(next));
  };

  return { isDark, toggle, mounted };
}

export function DarkModeToggle() {
  const { isDark, toggle, mounted } = useDarkMode();

  // Avoid hydration mismatch
  if (!mounted) {
    return (
      <button
        className="w-8 h-8 rounded-lg bg-gray-800 dark:bg-gray-900 flex items-center justify-center"
        aria-label="Dark mode toggle"
      >
        <span className="w-4 h-4" />
      </button>
    );
  }

  return (
    <button
      onClick={toggle}
      className={`w-8 h-8 rounded-lg flex items-center justify-center transition-colors ${
        isDark
          ? 'bg-gray-700 dark:bg-gray-900 hover:bg-gray-600 dark:bg-gray-900 text-yellow-300'
          : 'bg-gray-800 dark:bg-gray-900 hover:bg-gray-700 dark:bg-gray-900 text-gray-400 dark:text-gray-500'
      }`}
      aria-label={isDark ? 'Licht modus' : 'Donker modus'}
      title={isDark ? 'Licht modus' : 'Donker modus'}
    >
      {isDark ? (
        // Sun icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
        </svg>
      ) : (
        // Moon icon
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
        </svg>
      )}
    </button>
  );
}

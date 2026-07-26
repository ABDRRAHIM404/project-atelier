'use client';

import { useCallback, useEffect, useState } from 'react';

const THEME_STORAGE_KEY = 'project-atelier-theme';

type Theme = 'dark' | 'light';

function isTheme(value: string | null): value is Theme {
  return value === 'dark' || value === 'light';
}

function preferredTheme(): Theme {
  try {
    const storedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
    if (isTheme(storedTheme)) return storedTheme;
  } catch {
    // A blocked storage API should not prevent device-preference theming.
  }
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(theme: Theme) {
  document.documentElement.dataset.theme = theme;
  document.documentElement.style.colorScheme = theme;
  document
    .querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    ?.setAttribute('content', theme === 'dark' ? '#121815' : '#fff8ed');
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme | null>(null);

  const synchronizeTheme = useCallback(() => {
    const nextTheme = preferredTheme();
    applyTheme(nextTheme);
    setTheme(nextTheme);
  }, []);

  useEffect(() => {
    const frame = window.requestAnimationFrame(synchronizeTheme);
    const media = window.matchMedia('(prefers-color-scheme: dark)');

    function onPreferenceChange() {
      try {
        if (isTheme(window.localStorage.getItem(THEME_STORAGE_KEY))) return;
      } catch {
        // Continue with the live device preference when storage is unavailable.
      }
      synchronizeTheme();
    }

    function onStorage(event: StorageEvent) {
      if (event.key === THEME_STORAGE_KEY || event.key === null) synchronizeTheme();
    }

    media.addEventListener('change', onPreferenceChange);
    window.addEventListener('storage', onStorage);
    return () => {
      window.cancelAnimationFrame(frame);
      media.removeEventListener('change', onPreferenceChange);
      window.removeEventListener('storage', onStorage);
    };
  }, [synchronizeTheme]);

  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const label = nextTheme === 'dark' ? 'تفعيل الوضع الداكن' : 'تفعيل الوضع الفاتح';

  return (
    <button
      aria-label={label}
      aria-pressed={theme === 'dark'}
      className="theme-toggle"
      onClick={() => {
        applyTheme(nextTheme);
        try {
          window.localStorage.setItem(THEME_STORAGE_KEY, nextTheme);
        } catch {
          // The selected theme still applies for this page when persistence is blocked.
        }
        setTheme(nextTheme);
      }}
      title={label}
      type="button"
    >
      <svg aria-hidden="true" className="theme-toggle__sun" fill="none" viewBox="0 0 24 24">
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42M17.65 17.65l1.42 1.42M2 12h2M20 12h2M4.93 19.07l1.42-1.42M17.65 6.35l1.42-1.42" />
      </svg>
      <svg aria-hidden="true" className="theme-toggle__moon" fill="none" viewBox="0 0 24 24">
        <path d="M20.2 15.2A8.5 8.5 0 0 1 8.8 3.8a8.5 8.5 0 1 0 11.4 11.4Z" />
      </svg>
    </button>
  );
}

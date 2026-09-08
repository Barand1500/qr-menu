import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { morphAdminAccent } from '@/lib/adminAccentMorph';

export type ThemeMode = 'light' | 'dark';

export type AdminAccentId = 'blue' | 'emerald' | 'violet';

export const ADMIN_ACCENT_OPTIONS: {
  id: AdminAccentId;
  label: string;
  /** Combobox önizleme rengi */
  swatch: string;
}[] = [
  { id: 'blue', label: 'Mavi', swatch: '#2563eb' },
  { id: 'emerald', label: 'Yeşil', swatch: '#059669' },
  { id: 'violet', label: 'Mor', swatch: '#7c3aed' },
];

interface ThemeContextType {
  theme: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  accent: AdminAccentId;
  setAccent: (id: AdminAccentId) => void;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

const THEME_KEY = 'menu_qr_theme';
const ACCENT_KEY = 'menu_qr_admin_accent';

function readAccent(): AdminAccentId {
  const raw = localStorage.getItem(ACCENT_KEY);
  if (raw === 'emerald' || raw === 'violet' || raw === 'blue') return raw;
  return 'blue';
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem(THEME_KEY);
    return saved === 'dark' ? 'dark' : 'light';
  });
  const [accent, setAccentState] = useState<AdminAccentId>(readAccent);
  const accentRef = useRef(accent);
  const themeRef = useRef(theme);

  useEffect(() => {
    themeRef.current = theme;
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.setAttribute('data-accent', accent);
    localStorage.setItem(ACCENT_KEY, accent);
  }, []);

  function setTheme(mode: ThemeMode) {
    setThemeState(mode);
  }

  function toggleTheme() {
    setThemeState((t) => (t === 'light' ? 'dark' : 'light'));
  }

  function setAccent(id: AdminAccentId) {
    if (id === accentRef.current) return;
    const from = accentRef.current;
    accentRef.current = id;
    setAccentState(id);
    localStorage.setItem(ACCENT_KEY, id);
    morphAdminAccent(themeRef.current, from, id, () => {
      document.documentElement.setAttribute('data-accent', id);
    });
  }

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
}

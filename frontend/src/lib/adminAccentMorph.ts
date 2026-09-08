import gsap from 'gsap';
import type { AdminAccentId, ThemeMode } from '@/contexts/ThemeContext';

export type AccentPalette = {
  accent: string;
  hover: string;
  soft: string;
  text: string;
  sidebar: string;
  sidebarDark: string;
  sidebarActiveBg: string;
  sidebarActiveText: string;
  badge: string;
  btnText: string;
};

export const ADMIN_ACCENT_PALETTES: Record<ThemeMode, Record<AdminAccentId, AccentPalette>> = {
  light: {
    blue: {
      accent: '#2563eb',
      hover: '#1d4ed8',
      soft: '#dbeafe',
      text: '#1e40af',
      sidebar: '#1a73e8',
      sidebarDark: '#1557b0',
      sidebarActiveBg: '#ffffff',
      sidebarActiveText: '#1a56c4',
      badge: '#2563eb',
      btnText: '#ffffff',
    },
    emerald: {
      accent: '#059669',
      hover: '#047857',
      soft: '#d1fae5',
      text: '#065f46',
      sidebar: '#059669',
      sidebarDark: '#047857',
      sidebarActiveBg: '#ffffff',
      sidebarActiveText: '#047857',
      badge: '#059669',
      btnText: '#ffffff',
    },
    violet: {
      accent: '#7c3aed',
      hover: '#6d28d9',
      soft: '#ede9fe',
      text: '#5b21b6',
      sidebar: '#7c3aed',
      sidebarDark: '#6d28d9',
      sidebarActiveBg: '#ffffff',
      sidebarActiveText: '#6d28d9',
      badge: '#7c3aed',
      btnText: '#ffffff',
    },
  },
  dark: {
    blue: {
      accent: '#60a5fa',
      hover: '#3b82f6',
      soft: 'rgba(96, 165, 250, 0.15)',
      text: '#93c5fd',
      sidebar: '#141414',
      sidebarDark: '#0a0a0a',
      sidebarActiveBg: '#60a5fa',
      sidebarActiveText: '#0c0c0c',
      badge: '#60a5fa',
      btnText: '#0c0c0c',
    },
    emerald: {
      accent: '#34d399',
      hover: '#10b981',
      soft: 'rgba(52, 211, 153, 0.15)',
      text: '#6ee7b7',
      sidebar: '#141414',
      sidebarDark: '#0a0a0a',
      sidebarActiveBg: '#34d399',
      sidebarActiveText: '#0c0c0c',
      badge: '#34d399',
      btnText: '#0c0c0c',
    },
    violet: {
      accent: '#a78bfa',
      hover: '#8b5cf6',
      soft: 'rgba(167, 139, 250, 0.15)',
      text: '#c4b5fd',
      sidebar: '#141414',
      sidebarDark: '#0a0a0a',
      sidebarActiveBg: '#a78bfa',
      sidebarActiveText: '#0c0c0c',
      badge: '#a78bfa',
      btnText: '#0c0c0c',
    },
  },
};

const VAR_MAP: { key: keyof AccentPalette; css: string }[] = [
  { key: 'accent', css: '--admin-accent' },
  { key: 'hover', css: '--admin-accent-hover' },
  { key: 'soft', css: '--admin-accent-soft' },
  { key: 'text', css: '--admin-accent-text' },
  { key: 'sidebar', css: '--admin-sidebar' },
  { key: 'sidebarDark', css: '--admin-sidebar-dark' },
  { key: 'sidebarActiveBg', css: '--admin-sidebar-active-bg' },
  { key: 'sidebarActiveText', css: '--admin-sidebar-active-text' },
  { key: 'badge', css: '--admin-badge' },
  { key: 'btnText', css: '--admin-btn-primary-text' },
];

let accentTween: gsap.core.Tween | null = null;

function paletteToVars(p: AccentPalette): Record<string, string> {
  const out: Record<string, string> = {};
  for (const { key, css } of VAR_MAP) out[css] = p[key];
  return out;
}

function clearAccentInlineVars(root: HTMLElement) {
  for (const { css } of VAR_MAP) root.style.removeProperty(css);
}

/** Bukalemun geçişi: vurgu renklerini yumuşak morph eder */
export function morphAdminAccent(
  theme: ThemeMode,
  fromId: AdminAccentId,
  toId: AdminAccentId,
  onComplete?: () => void
) {
  const root = document.documentElement;
  const from = ADMIN_ACCENT_PALETTES[theme][fromId];
  const to = ADMIN_ACCENT_PALETTES[theme][toId];

  accentTween?.kill();

  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (reduce || fromId === toId) {
    clearAccentInlineVars(root);
    root.setAttribute('data-accent', toId);
    onComplete?.();
    return;
  }

  gsap.set(root, paletteToVars(from));

  accentTween = gsap.to(root, {
    ...paletteToVars(to),
    duration: 0.95,
    ease: 'power2.inOut',
    onComplete: () => {
      root.setAttribute('data-accent', toId);
      clearAccentInlineVars(root);
      accentTween = null;
      onComplete?.();
    },
  });
}

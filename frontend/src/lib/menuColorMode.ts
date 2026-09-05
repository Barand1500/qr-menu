export type MenuColorMode = 'day' | 'night';

const STORAGE_KEY = 'menu_color_mode';

export type MenuThemeId = 'sade' | 'alive' | 'luxury' | string;

/** Temanın varsayılan renk modu (mevcut görünüm) */
export function defaultColorModeForTheme(theme: MenuThemeId): MenuColorMode {
  if (theme === 'luxury') return 'night';
  return 'day';
}

export function loadMenuColorMode(theme: MenuThemeId): MenuColorMode {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'day' || saved === 'night') return saved;
  } catch {
    /* ignore */
  }
  return defaultColorModeForTheme(theme);
}

export function saveMenuColorMode(mode: MenuColorMode) {
  try {
    localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    /* ignore */
  }
}

export function toggleMenuColorMode(current: MenuColorMode): MenuColorMode {
  return current === 'day' ? 'night' : 'day';
}

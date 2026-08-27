import type { MenuThemeOption } from './types';

export const DEFAULT_MENU_THEME = 'sade';

export const MENU_THEMES: MenuThemeOption[] = [
  {
    id: 'sade',
    name: 'Sade',
    description: 'Temiz kartlar, yumuşak hover ve sakin menü deneyimi.',
    locked: false,
    previewClass: 'theme-preview--sade',
  },
  {
    id: 'alive',
    name: 'Canlı',
    description: 'Daha güçlü hareket, glow ve dikkat çeken kategori kartları.',
    locked: true,
    previewClass: 'theme-preview--alive',
  },
  {
    id: 'luxury',
    name: 'Lüks',
    description: 'Noir champagne editorial: serif masthead, full-bleed bölümler ve kartsız lüks ürün satırları.',
    locked: true,
    previewClass: 'theme-preview--luxury',
  },
];

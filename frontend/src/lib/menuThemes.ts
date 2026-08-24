export type ThemeKind = 'welcome' | 'menu';

export interface MenuThemeOption {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  previewClass: string;
}

export const WELCOME_THEMES: MenuThemeOption[] = [
  {
    id: 'vibrant',
    name: 'Renkli Animasyonlu',
    description: 'Aurora, ışık orb’ları ve yumuşak animasyonlarla canlı karşılama.',
    locked: false,
    previewClass: 'theme-preview--vibrant',
  },
  {
    id: 'cinema',
    name: 'Sinematik',
    description: 'Koyu film atmosferi, yavaş ışık geçişleri ve premium his.',
    locked: true,
    previewClass: 'theme-preview--cinema',
  },
  {
    id: 'neon',
    name: 'Neon Gece',
    description: 'Neon vurgular, ritmik parıltılar ve gece kulübü enerjisi.',
    locked: true,
    previewClass: 'theme-preview--neon',
  },
];

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
    description: 'Altın vurgular, yumuşak gölgeler ve high-end restoran hissi.',
    locked: true,
    previewClass: 'theme-preview--luxury',
  },
];

export const DEFAULT_WELCOME_THEME = 'vibrant';
export const DEFAULT_MENU_THEME = 'sade';

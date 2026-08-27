import type { MenuThemeOption } from './types';

export const DEFAULT_WELCOME_THEME = 'vibrant';

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

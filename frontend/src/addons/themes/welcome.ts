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
  {
    id: 'kitty',
    name: 'Kitty',
    description: 'Şeftali üst sahne, bakan kedi silueti ve sade beyaz karşılama alanı.',
    locked: true,
    previewClass: 'theme-preview--kitty',
  },
  {
    id: 'basketball',
    name: 'Basketbol Menü',
    description: 'Logonu potaya at; fizik, ses ve konfetiyle menünün kilidini aç.',
    locked: true,
    previewClass: 'theme-preview--basketball',
  },
];

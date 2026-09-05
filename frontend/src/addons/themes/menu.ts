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
    description: 'Yeşil kafe dili: karşılama kartı, dikey kategori rail ve taşan ürün görselleri.',
    locked: true,
    previewClass: 'theme-preview--alive',
  },  {
    id: 'animasyon',
    name: 'Animasyonlu',
    description: 'Gri-krem editorial: soft ürün kaydırma, modal detay ve sepet animasyonları.',
    locked: true,
    previewClass: 'theme-preview--animasyon',
  },
  {
    id: 'luxury',
    name: 'Lüks',
    description: 'Noir champagne editorial: serif masthead, full-bleed bölümler ve kartsız lüks ürün satırları.',
    locked: true,
    previewClass: 'theme-preview--luxury',
  },
  {
    id: 'siparis',
    name: 'Sipariş Odaklı',
    description: 'Kırmızı-krem fast menü: banner, kategori ikonları, popüler kartlar ve masa sepeti.',
    locked: false,
    previewClass: 'theme-preview--siparis',
  },
];

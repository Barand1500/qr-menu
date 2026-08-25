/** Frontend katalog — kilit durumu API'deki owned listesine göre hesaplanır */

export type AddonCategory = 'welcome' | 'menu' | 'qr';

export interface AddonProduct {
  id: string;
  category: AddonCategory;
  name: string;
  description: string;
  themeId?: string;
  previewClass?: string;
  owned?: boolean;
}

export const ADDON_CATALOG: AddonProduct[] = [
  {
    id: 'welcome-cinema',
    category: 'welcome',
    name: 'Sinematik',
    description: 'Koyu film atmosferi, yavaş ışık geçişleri ve premium his.',
    themeId: 'cinema',
    previewClass: 'theme-preview--cinema',
  },
  {
    id: 'welcome-neon',
    category: 'welcome',
    name: 'Neon Gece',
    description: 'Neon vurgular, ritmik parıltılar ve gece kulübü enerjisi.',
    themeId: 'neon',
    previewClass: 'theme-preview--neon',
  },
  {
    id: 'menu-alive',
    category: 'menu',
    name: 'Canlı',
    description: 'Daha güçlü hareket, glow ve dikkat çeken kategori kartları.',
    themeId: 'alive',
    previewClass: 'theme-preview--alive',
  },
  {
    id: 'menu-luxury',
    category: 'menu',
    name: 'Lüks',
    description: 'Altın vurgular, yumuşak gölgeler ve high-end restoran hissi.',
    themeId: 'luxury',
    previewClass: 'theme-preview--luxury',
  },
  {
    id: 'qr-pack',
    category: 'qr',
    name: 'QR Paketi',
    description:
      'Renkli QR, logo ortalı, masa bazlı linkler, kampanya QR ve gelişmiş yazdırma.',
    previewClass: 'theme-preview--qr',
  },
];

export function themeAddonId(kind: 'welcome' | 'menu', themeId: string) {
  return ADDON_CATALOG.find((p) => p.category === kind && p.themeId === themeId)?.id;
}

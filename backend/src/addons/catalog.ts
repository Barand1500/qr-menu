import type { AddonProductDef, AddonProductId } from './types.js';

export const ADDON_PRODUCTS: AddonProductDef[] = [
  {
    id: 'welcome-cinema',
    category: 'welcome',
    name: 'Sinematik',
    description: 'Koyu film atmosferi, yavaş ışık geçişleri ve premium his.',
    themeId: 'cinema',
  },
  {
    id: 'welcome-neon',
    category: 'welcome',
    name: 'Neon Gece',
    description: 'Neon vurgular, ritmik parıltılar ve gece kulübü enerjisi.',
    themeId: 'neon',
  },
  {
    id: 'menu-alive',
    category: 'menu',
    name: 'Canlı',
    description: 'Daha güçlü hareket, glow ve dikkat çeken kategori kartları.',
    themeId: 'alive',
  },
  {
    id: 'menu-luxury',
    category: 'menu',
    name: 'Lüks',
    description: 'Altın vurgular, yumuşak gölgeler ve high-end restoran hissi.',
    themeId: 'luxury',
  },
  {
    id: 'qr-pack',
    category: 'qr',
    name: 'QR Paketi',
    description:
      'Renkli QR, logo ortalı QR, masa bazlı QR, kampanyalı link ve gelişmiş yazdırma.',
  },
  {
    id: 'lang-pack',
    category: 'lang',
    name: 'Dil Paketi',
    description:
      'Toplu çeviri: ürün, kategori, vitrin ve hikaye boş alanlarını seçtiğin dile doldur.',
  },
  {
    id: 'menu-assistant',
    category: 'feature',
    name: 'Menü Asistanı',
    description:
      '3 soruluk akıllı yardımcı: müşteriye 3–5 ürün önerir. İstediğin zaman menüden kapatıp açabilirsin.',
    toggleable: true,
  },
];

export function themeIdToAddon(
  kind: 'welcome' | 'menu',
  themeId: string
): AddonProductId | null {
  const found = ADDON_PRODUCTS.find((p) => p.category === kind && p.themeId === themeId);
  return found?.id ?? null;
}

import type { AddonProductDef, AddonProductId } from './types.js';

export const ADDON_PRODUCTS: AddonProductDef[] = [
  {
    id: 'welcome-vibrant',
    category: 'welcome',
    name: 'Renkli Animasyonlu',
    description: 'Aurora, ışık orb’ları ve yumuşak animasyonlarla canlı karşılama.',
    themeId: 'vibrant',
    free: true,
  },
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
    id: 'welcome-kitty',
    category: 'welcome',
    name: 'Kitty',
    description: 'Şeftali üst sahne, bakan kedi silueti ve sade beyaz karşılama alanı.',
    themeId: 'kitty',
  },
  {
    id: 'menu-sade',
    category: 'menu',
    name: 'Sade',
    description: 'Temiz kartlar, yumuşak hover ve sakin menü deneyimi.',
    themeId: 'sade',
    free: true,
  },
  {
    id: 'menu-siparis',
    category: 'menu',
    name: 'Sipariş Odaklı',
    description: 'Kırmızı-krem fast menü: banner, kategori ikonları, popüler kartlar ve masa sepeti.',
    themeId: 'siparis',
    free: true,
  },
  {
    id: 'menu-alive',
    category: 'menu',
    name: 'Canlı',
    description: 'Yeşil kafe dili: karşılama kartı, dikey kategori rail ve taşan ürün görselleri.',
    themeId: 'alive',
  },
  {
    id: 'menu-animasyon',
    category: 'menu',
    name: 'Animasyonlu',
    description: 'Gri-krem editorial sahne: soft kaydırma, modal detay ve sepete uçuş animasyonları.',
    themeId: 'animasyon',
  },
  {
    id: 'menu-luxury',
    category: 'menu',
    name: 'Lüks',
    description: 'Altın vurgular, yumuşak gölgeler ve high-end restoran hissi.',
    themeId: 'luxury',
  },
  {
    id: 'menu-linear',
    category: 'menu',
    name: 'Linear',
    description:
      'Krem–zeytin split sahne: dalgalı ayırıcı, yuvarlak ürünler ve salt vitrin menü.',
    themeId: 'linear',
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

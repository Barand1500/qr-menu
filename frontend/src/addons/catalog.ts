import type { AddonProduct } from './types';

/** Frontend katalog — kilit durumu API'deki owned listesine göre hesaplanır */
export const ADDON_CATALOG: AddonProduct[] = [
  {
    id: 'welcome-vibrant',
    category: 'welcome',
    name: 'Renkli Animasyonlu',
    description: 'Aurora, ışık orb’ları ve yumuşak animasyonlarla canlı karşılama.',
    themeId: 'vibrant',
    previewClass: 'theme-preview--vibrant',
    free: true,
  },
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
    id: 'welcome-kitty',
    category: 'welcome',
    name: 'Kitty',
    description: 'Şeftali üst sahne, bakan kedi silueti ve sade beyaz karşılama alanı.',
    themeId: 'kitty',
    previewClass: 'theme-preview--kitty',
  },
  {
    id: 'welcome-basketball',
    category: 'welcome',
    name: 'Basketbol Menü',
    description: 'Logonu potaya at; fizik, ses ve konfetiyle menünün kilidini aç.',
    themeId: 'basketball',
    previewClass: 'theme-preview--basketball',
  },
  {
    id: 'menu-sade',
    category: 'menu',
    name: 'Sade',
    description: 'Temiz kartlar, yumuşak hover ve sakin menü deneyimi.',
    themeId: 'sade',
    previewClass: 'theme-preview--sade',
    free: true,
  },
  {
    id: 'menu-siparis',
    category: 'menu',
    name: 'Sipariş Odaklı',
    description: 'Kırmızı-krem fast menü: banner, kategori ikonları, popüler kartlar ve masa sepeti.',
    themeId: 'siparis',
    previewClass: 'theme-preview--siparis',
    free: true,
  },
  {
    id: 'menu-alive',
    category: 'menu',
    name: 'Canlı',
    description: 'Yeşil kafe dili: karşılama kartı, dikey kategori rail ve taşan ürün görselleri.',
    themeId: 'alive',
    previewClass: 'theme-preview--alive',
  },
  {
    id: 'menu-animasyon',
    category: 'menu',
    name: 'Animasyonlu',
    description: 'Gri-krem editorial sahne: soft kaydırma, modal detay ve sepete uçuş animasyonları.',
    themeId: 'animasyon',
    previewClass: 'theme-preview--animasyon',
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
    id: 'menu-linear',
    category: 'menu',
    name: 'Linear',
    description:
      'Krem–zeytin split sahne: dalgalı ayırıcı, yuvarlak ürünler ve salt vitrin menü.',
    themeId: 'linear',
    previewClass: 'theme-preview--linear',
  },
  {
    id: 'qr-pack',
    category: 'qr',
    name: 'QR Paketi',
    description:
      'Renkli QR, logo ortalı, masa bazlı linkler, kampanya QR ve gelişmiş yazdırma.',
    previewClass: 'theme-preview--qr',
  },
  {
    id: 'lang-pack',
    category: 'lang',
    name: 'Dil Paketi',
    description:
      'Toplu çeviri: ürün, kategori, vitrin ve hikaye boş alanlarını seçtiğin dile doldur.',
    previewClass: 'theme-preview--lang',
  },
  {
    id: 'menu-assistant',
    category: 'feature',
    name: 'Menü Asistanı',
    description:
      '3 soruluk akıllı yardımcı: müşteriye 3–5 ürün önerir. İstediğin zaman menüden kapatıp açabilirsin.',
    previewClass: 'theme-preview--assistant',
    toggleable: true,
  },
];

export function themeAddonId(kind: 'welcome' | 'menu', themeId: string) {
  return ADDON_CATALOG.find((p) => p.category === kind && p.themeId === themeId)?.id;
}

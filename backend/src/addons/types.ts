export type AddonProductId =
  | 'welcome-vibrant'
  | 'welcome-cinema'
  | 'welcome-neon'
  | 'menu-sade'
  | 'menu-siparis'
  | 'menu-alive'
  | 'menu-luxury'
  | 'menu-animasyon'
  | 'menu-linear'
  | 'qr-pack'
  | 'lang-pack'
  | 'menu-assistant';

export type AddonCategory = 'welcome' | 'menu' | 'qr' | 'lang' | 'feature';

export interface AddonProductDef {
  id: AddonProductId;
  category: AddonCategory;
  name: string;
  description: string;
  themeId?: string;
  /** Bedava — her zaman açık, satın alma yok */
  free?: boolean;
  /** Satın alındıktan sonra aç/kapa yapılabilir */
  toggleable?: boolean;
}

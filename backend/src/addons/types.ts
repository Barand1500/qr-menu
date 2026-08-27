export type AddonProductId =
  | 'welcome-cinema'
  | 'welcome-neon'
  | 'menu-alive'
  | 'menu-luxury'
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
  /** Satın alındıktan sonra aç/kapa yapılabilir */
  toggleable?: boolean;
}

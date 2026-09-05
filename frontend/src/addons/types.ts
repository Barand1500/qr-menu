export type AddonCategory = 'welcome' | 'menu' | 'qr' | 'lang' | 'feature';

export interface AddonProduct {
  id: string;
  category: AddonCategory;
  name: string;
  description: string;
  themeId?: string;
  previewClass?: string;
  /** Bedava — her zaman açık, satın alma yok */
  free?: boolean;
  owned?: boolean;
  enabled?: boolean;
  toggleable?: boolean;
}

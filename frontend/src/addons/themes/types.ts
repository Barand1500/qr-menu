export type ThemeKind = 'welcome' | 'menu';

export interface MenuThemeOption {
  id: string;
  name: string;
  description: string;
  locked: boolean;
  previewClass: string;
}

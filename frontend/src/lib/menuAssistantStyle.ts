export const MENU_ASSISTANT_STYLES = ['sunset', 'berry', 'dark'] as const;
export type MenuAssistantStyle = (typeof MENU_ASSISTANT_STYLES)[number];

export const MENU_ASSISTANT_STYLE_KEY = 'menu_assistant_style';

export function parseMenuAssistantStyle(raw?: string | null): MenuAssistantStyle {
  if (raw === 'berry' || raw === 'dark' || raw === 'sunset') return raw;
  return 'sunset';
}

export const MENU_ASSISTANT_STYLE_OPTIONS: {
  id: MenuAssistantStyle;
  label: string;
  desc: string;
}[] = [
  { id: 'sunset', label: 'Günbatımı', desc: 'Mavi & turuncu — varsayılan' },
  { id: 'berry', label: 'Mor & Pembe', desc: 'Canlı ve dikkat çekici' },
  { id: 'dark', label: 'Koyu', desc: 'Sade, gece modu hissi' },
];

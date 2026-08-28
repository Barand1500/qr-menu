export const MENU_ASSISTANT_STYLES = ['sunset', 'berry', 'dark'] as const;
export type MenuAssistantStyle = (typeof MENU_ASSISTANT_STYLES)[number];

export const MENU_ASSISTANT_STYLE_KEY = 'menu_assistant_style';

export function parseMenuAssistantStyle(raw?: string | null): MenuAssistantStyle {
  if (raw === 'berry' || raw === 'dark' || raw === 'sunset') return raw;
  return 'sunset';
}

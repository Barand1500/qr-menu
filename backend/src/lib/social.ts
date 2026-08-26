/** Backend — sosyal medya ayarları (setting: social_links) */

const PLATFORM_IDS = new Set([
  'instagram',
  'facebook',
  'tiktok',
  'x',
  'youtube',
  'whatsapp',
  'linkedin',
  'telegram',
  'pinterest',
  'threads',
]);

const LABELS: Record<string, string> = {
  instagram: 'Instagram',
  facebook: 'Facebook',
  tiktok: 'TikTok',
  x: 'X',
  youtube: 'YouTube',
  whatsapp: 'WhatsApp',
  linkedin: 'LinkedIn',
  telegram: 'Telegram',
  pinterest: 'Pinterest',
  threads: 'Threads',
};

const CUSTOM_ICON_KEYS = new Set([
  'link',
  'globe',
  'star',
  'heart',
  'map',
  'phone',
  'mail',
  'shop',
  'utensils',
  'camera',
]);

export interface SocialLinkConfig {
  id: string;
  value: string;
  showWelcome: boolean;
  showMenu: boolean;
  label?: string;
  iconKey?: string;
  iconUrl?: string | null;
}

export interface PublicSocialLink {
  id: string;
  url: string;
  label: string;
  iconKey?: string;
  iconUrl?: string | null;
  color?: string;
}

function isCustomId(id: string) {
  return id.startsWith('custom-');
}

export function parseSocialLinks(raw: string | null | undefined): SocialLinkConfig[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const out: SocialLinkConfig[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') continue;
      const id = String((item as { id?: string }).id || '');
      if (!id) continue;

      if (PLATFORM_IDS.has(id)) {
        out.push({
          id,
          value: String((item as { value?: string }).value || '').trim(),
          showWelcome: Boolean((item as { showWelcome?: boolean }).showWelcome),
          showMenu: Boolean((item as { showMenu?: boolean }).showMenu),
        });
        continue;
      }

      if (isCustomId(id)) {
        const iconKey = String((item as { iconKey?: string }).iconKey || 'link');
        out.push({
          id,
          value: String((item as { value?: string }).value || '').trim(),
          showWelcome: Boolean((item as { showWelcome?: boolean }).showWelcome),
          showMenu: Boolean((item as { showMenu?: boolean }).showMenu),
          label: String((item as { label?: string }).label || '').trim(),
          iconKey: CUSTOM_ICON_KEYS.has(iconKey) ? iconKey : 'link',
          iconUrl: (item as { iconUrl?: string | null }).iconUrl
            ? String((item as { iconUrl?: string }).iconUrl)
            : null,
        });
      }
    }
    return out;
  } catch {
    return [];
  }
}

export function serializeSocialLinks(items: SocialLinkConfig[]): string {
  const cleaned = items
    .filter((i) => PLATFORM_IDS.has(i.id) || isCustomId(i.id))
    .map((i) => {
      if (isCustomId(i.id)) {
        return {
          id: i.id,
          value: String(i.value || '').trim(),
          showWelcome: Boolean(i.showWelcome),
          showMenu: Boolean(i.showMenu),
          label: String(i.label || '').trim(),
          iconKey: CUSTOM_ICON_KEYS.has(String(i.iconKey || '')) ? i.iconKey : 'link',
          iconUrl: i.iconUrl || null,
        };
      }
      return {
        id: i.id,
        value: String(i.value || '').trim(),
        showWelcome: Boolean(i.showWelcome),
        showMenu: Boolean(i.showMenu),
      };
    })
    .filter((i) => isCustomId(i.id) || i.value || i.showWelcome || i.showMenu);
  return JSON.stringify(cleaned);
}

function normalizePhoneDigits(raw: string) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `90${digits.slice(1)}`;
  }
  return digits;
}

function resolveUrl(id: string, value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (id === 'whatsapp') {
    const digits = normalizePhoneDigits(trimmed);
    if (digits.length < 10) return null;
    return `https://wa.me/${digits}`;
  }
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

const COLORS: Record<string, string> = {
  instagram: '#E1306C',
  facebook: '#1877F2',
  tiktok: '#010101',
  x: '#000000',
  youtube: '#FF0000',
  whatsapp: '#25D366',
  linkedin: '#0A66C2',
  telegram: '#2AABEE',
  pinterest: '#E60023',
  threads: '#101010',
};

export function publicSocialLinks(
  configs: SocialLinkConfig[],
  place: 'welcome' | 'menu'
): PublicSocialLink[] {
  const out: PublicSocialLink[] = [];
  for (const cfg of configs) {
    const show = place === 'welcome' ? cfg.showWelcome : cfg.showMenu;
    if (!show || !cfg.value.trim()) continue;
    const url = resolveUrl(cfg.id, cfg.value);
    if (!url) continue;
    out.push({
      id: cfg.id,
      url,
      label: cfg.label?.trim() || LABELS[cfg.id] || 'Link',
      iconKey: cfg.iconKey,
      iconUrl: cfg.iconUrl || null,
      color: COLORS[cfg.id] || '#475569',
    });
  }
  return out;
}

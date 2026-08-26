/** Ortak sosyal medya katalogu — admin + public */

export type SocialPlatformId =
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'youtube'
  | 'whatsapp'
  | 'linkedin'
  | 'telegram'
  | 'pinterest'
  | 'threads';

export type CustomIconKey =
  | 'link'
  | 'globe'
  | 'star'
  | 'heart'
  | 'map'
  | 'phone'
  | 'mail'
  | 'shop'
  | 'utensils'
  | 'camera';

export interface SocialPlatformDef {
  id: SocialPlatformId;
  name: string;
  placeholder: string;
  kind: 'url' | 'phone';
  color: string;
}

export interface SocialLinkConfig {
  id: string;
  value: string;
  showWelcome: boolean;
  showMenu: boolean;
  /** Özel link için */
  label?: string;
  iconKey?: CustomIconKey;
  iconUrl?: string | null;
}

export interface PublicSocialLink {
  id: string;
  url: string;
  label: string;
  iconKey?: CustomIconKey;
  iconUrl?: string | null;
  color?: string;
}

export const CUSTOM_ICON_OPTIONS: { id: CustomIconKey; label: string }[] = [
  { id: 'link', label: 'Link' },
  { id: 'globe', label: 'Web' },
  { id: 'star', label: 'Yıldız' },
  { id: 'heart', label: 'Kalp' },
  { id: 'map', label: 'Konum' },
  { id: 'phone', label: 'Telefon' },
  { id: 'mail', label: 'Mail' },
  { id: 'shop', label: 'Mağaza' },
  { id: 'utensils', label: 'Yemek' },
  { id: 'camera', label: 'Kamera' },
];

export const SOCIAL_PLATFORMS: SocialPlatformDef[] = [
  {
    id: 'instagram',
    name: 'Instagram',
    placeholder: 'https://instagram.com/...',
    kind: 'url',
    color: '#E1306C',
  },
  {
    id: 'facebook',
    name: 'Facebook',
    placeholder: 'https://facebook.com/...',
    kind: 'url',
    color: '#1877F2',
  },
  {
    id: 'tiktok',
    name: 'TikTok',
    placeholder: 'https://tiktok.com/@...',
    kind: 'url',
    color: '#010101',
  },
  {
    id: 'x',
    name: 'X',
    placeholder: 'https://x.com/...',
    kind: 'url',
    color: '#000000',
  },
  {
    id: 'youtube',
    name: 'YouTube',
    placeholder: 'https://youtube.com/@...',
    kind: 'url',
    color: '#FF0000',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp',
    placeholder: '05xx xxx xx xx',
    kind: 'phone',
    color: '#25D366',
  },
  {
    id: 'linkedin',
    name: 'LinkedIn',
    placeholder: 'https://linkedin.com/company/...',
    kind: 'url',
    color: '#0A66C2',
  },
  {
    id: 'telegram',
    name: 'Telegram',
    placeholder: 'https://t.me/...',
    kind: 'url',
    color: '#2AABEE',
  },
  {
    id: 'pinterest',
    name: 'Pinterest',
    placeholder: 'https://pinterest.com/...',
    kind: 'url',
    color: '#E60023',
  },
  {
    id: 'threads',
    name: 'Threads',
    placeholder: 'https://threads.net/@...',
    kind: 'url',
    color: '#101010',
  },
];

const PLATFORM_ID_SET = new Set(SOCIAL_PLATFORMS.map((p) => p.id));

export function isCustomSocialId(id: string) {
  return id.startsWith('custom-');
}

export function socialPlatformById(id: string) {
  return SOCIAL_PLATFORMS.find((p) => p.id === id);
}

export function normalizePhoneDigits(raw: string) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0') && digits.length >= 10) {
    digits = `90${digits.slice(1)}`;
  }
  return digits;
}

export function resolveSocialUrl(id: string, value: string): string | null {
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

export function newCustomSocialLink(): SocialLinkConfig {
  return {
    id: `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    value: '',
    showWelcome: false,
    showMenu: false,
    label: '',
    iconKey: 'link',
    iconUrl: null,
  };
}

export function mergeSocialConfigs(raw: unknown): SocialLinkConfig[] {
  const platformMap = new Map<string, SocialLinkConfig>();
  const customs: SocialLinkConfig[] = [];

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;
      const row = item as Record<string, unknown>;
      const id = String(row.id || '');
      if (!id) continue;

      if (PLATFORM_ID_SET.has(id as SocialPlatformId)) {
        platformMap.set(id, {
          id,
          value: String(row.value || ''),
          showWelcome: Boolean(row.showWelcome),
          showMenu: Boolean(row.showMenu),
        });
        continue;
      }

      if (isCustomSocialId(id)) {
        customs.push({
          id,
          value: String(row.value || ''),
          showWelcome: Boolean(row.showWelcome),
          showMenu: Boolean(row.showMenu),
          label: String(row.label || ''),
          iconKey: (String(row.iconKey || 'link') as CustomIconKey) || 'link',
          iconUrl: row.iconUrl ? String(row.iconUrl) : null,
        });
      }
    }
  }

  const platforms = SOCIAL_PLATFORMS.map(
    (p) =>
      platformMap.get(p.id) || {
        id: p.id,
        value: '',
        showWelcome: false,
        showMenu: false,
      }
  );

  return [...platforms, ...customs];
}

export function splitSocialConfigs(configs: SocialLinkConfig[]) {
  return {
    platforms: configs.filter((c) => !isCustomSocialId(c.id)),
    customs: configs.filter((c) => isCustomSocialId(c.id)),
  };
}

export function filterPublicSocial(
  configs: SocialLinkConfig[],
  place: 'welcome' | 'menu'
): PublicSocialLink[] {
  const out: PublicSocialLink[] = [];
  for (const cfg of configs) {
    const show = place === 'welcome' ? cfg.showWelcome : cfg.showMenu;
    if (!show || !cfg.value.trim()) continue;
    const url = resolveSocialUrl(cfg.id, cfg.value);
    if (!url) continue;
    const def = socialPlatformById(cfg.id);
    out.push({
      id: cfg.id,
      url,
      label: cfg.label?.trim() || def?.name || 'Link',
      iconKey: cfg.iconKey,
      iconUrl: cfg.iconUrl || null,
      color: def?.color,
    });
  }
  return out;
}

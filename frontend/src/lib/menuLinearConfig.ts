export const LINEAR_FEATURE_ICONS = [
  'leaf',
  'heart',
  'cake',
  'strawberry',
  'sparkles',
  'coffee',
  'star',
  'utensils',
] as const;

export type LinearFeatureIcon = (typeof LINEAR_FEATURE_ICONS)[number];

export type LinearFeatureLine = {
  icon: LinearFeatureIcon;
  text: string;
};

export type LinearThemeConfig = {
  headline: string;
  subhead: string;
  features: LinearFeatureLine[];
};

export const DEFAULT_LINEAR_CONFIG: LinearThemeConfig = {
  headline: 'Menü',
  subhead: 'Özel anlar için',
  features: [
    { icon: 'leaf', text: 'Doğal malzemeler' },
    { icon: 'heart', text: 'Özenle hazırlanır' },
    { icon: 'cake', text: 'İnce tat ve aroma' },
    { icon: 'strawberry', text: 'Her gün taze' },
  ],
};

function isIcon(v: unknown): v is LinearFeatureIcon {
  return typeof v === 'string' && (LINEAR_FEATURE_ICONS as readonly string[]).includes(v);
}

export function parseLinearThemeConfig(raw?: string | null): LinearThemeConfig {
  if (!raw) {
    return {
      ...DEFAULT_LINEAR_CONFIG,
      features: DEFAULT_LINEAR_CONFIG.features.map((f) => ({ ...f })),
    };
  }
  try {
    const data = JSON.parse(raw) as Partial<LinearThemeConfig>;
    const featuresIn = Array.isArray(data.features) ? data.features : [];
    const features: LinearFeatureLine[] = [0, 1, 2, 3].map((i) => {
      const row = featuresIn[i] as Partial<LinearFeatureLine> | undefined;
      const fallback = DEFAULT_LINEAR_CONFIG.features[i];
      return {
        icon: isIcon(row?.icon) ? row.icon : fallback.icon,
        text:
          typeof row?.text === 'string' && row.text.trim()
            ? row.text.trim().slice(0, 80)
            : fallback.text,
      };
    });
    return {
      headline:
        typeof data.headline === 'string' && data.headline.trim()
          ? data.headline.trim().slice(0, 48)
          : DEFAULT_LINEAR_CONFIG.headline,
      subhead:
        typeof data.subhead === 'string' && data.subhead.trim()
          ? data.subhead.trim().slice(0, 64)
          : DEFAULT_LINEAR_CONFIG.subhead,
      features,
    };
  } catch {
    return {
      ...DEFAULT_LINEAR_CONFIG,
      features: DEFAULT_LINEAR_CONFIG.features.map((f) => ({ ...f })),
    };
  }
}

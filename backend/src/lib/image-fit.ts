/** Resim kırpma / sığdırma ayarı (işletme geneli). Görseller bozulmaz; menüde gösterilirken uygulanır. */
export const IMAGE_FIT_KEY = 'image_fit_config';

export const IMAGE_FIT_MODES = ['cover', 'contain'] as const;
export const IMAGE_FIT_FOCUS = [
  'center',
  'top',
  'bottom',
  'left',
  'right',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
] as const;
export const IMAGE_FIT_FILLS = ['theme', 'blur', 'white', 'black', 'color'] as const;
export const IMAGE_FIT_SCOPES = ['all', 'new'] as const;

export type ImageFitConfig = {
  /** Kapalıysa temanın kendi görünümü kullanılır. */
  enabled: boolean;
  /** cover: kırparak doldur · contain: bütün resmi sığdır */
  mode: (typeof IMAGE_FIT_MODES)[number];
  focus: (typeof IMAGE_FIT_FOCUS)[number];
  /** contain'de boş kalan alanın dolgusu */
  fill: (typeof IMAGE_FIT_FILLS)[number];
  color: string;
  /** contain'de kenar boşluğu, % (0-16) */
  padding: number;
  /** all: mevcut resimler dahil · new: yalnızca appliesFrom'dan sonra yüklenenler */
  scope: (typeof IMAGE_FIT_SCOPES)[number];
  appliesFrom: number;
  targets: { products: boolean; groups: boolean; showcase: boolean };
};

export const DEFAULT_IMAGE_FIT: ImageFitConfig = {
  enabled: false,
  mode: 'cover',
  focus: 'center',
  fill: 'theme',
  color: '#ffffff',
  padding: 0,
  scope: 'all',
  appliesFrom: 0,
  targets: { products: true, groups: true, showcase: true },
};

const pick = <T extends readonly string[]>(list: T, v: unknown, fallback: T[number]): T[number] =>
  typeof v === 'string' && (list as readonly string[]).includes(v) ? v : fallback;

export function parseImageFit(raw: unknown): ImageFitConfig {
  let src: Record<string, unknown> = {};
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (parsed && typeof parsed === 'object') src = parsed as Record<string, unknown>;
  } catch {
    /* bozuk kayıt: varsayılan */
  }
  const d = DEFAULT_IMAGE_FIT;
  const t = (src.targets && typeof src.targets === 'object' ? src.targets : {}) as Record<string, unknown>;
  const padding = Number(src.padding);
  const from = Number(src.appliesFrom);
  return {
    enabled: src.enabled === true,
    mode: pick(IMAGE_FIT_MODES, src.mode, d.mode),
    focus: pick(IMAGE_FIT_FOCUS, src.focus, d.focus),
    fill: pick(IMAGE_FIT_FILLS, src.fill, d.fill),
    color: typeof src.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(src.color) ? src.color : d.color,
    padding: Number.isFinite(padding) ? Math.min(16, Math.max(0, Math.round(padding))) : d.padding,
    scope: pick(IMAGE_FIT_SCOPES, src.scope, d.scope),
    appliesFrom: Number.isFinite(from) && from > 0 ? Math.floor(from) : 0,
    targets: {
      products: t.products !== false,
      groups: t.groups !== false,
      showcase: t.showcase !== false,
    },
  };
}

/**
 * Kaydedilecek ayarı hazırlar. "Yalnızca yeniler" ilk seçildiği an appliesFrom işaretlenir;
 * sonraki kayıtlarda aynı kalır, böylece diğer seçenekler değişince tarih kaymaz.
 */
export function nextImageFit(input: unknown, previous: ImageFitConfig, now = Date.now()): ImageFitConfig {
  const next = parseImageFit(input);
  next.appliesFrom =
    next.scope === 'new' ? (previous.scope === 'new' && previous.appliesFrom ? previous.appliesFrom : now) : 0;
  return next;
}

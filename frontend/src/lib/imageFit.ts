import type { CSSProperties } from 'react';

/** Resim kırpma / sığdırma ayarı. Sunucudaki lib/image-fit.ts ile aynı biçimdedir. */
export type FitMode = 'cover' | 'contain';
export type FitFocus =
  | 'center'
  | 'top'
  | 'bottom'
  | 'left'
  | 'right'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right';
export type FitFill = 'theme' | 'blur' | 'white' | 'black' | 'color';
export type FitKind = 'products' | 'groups' | 'showcase';

export type ImageFitConfig = {
  enabled: boolean;
  mode: FitMode;
  focus: FitFocus;
  fill: FitFill;
  color: string;
  padding: number;
  scope: 'all' | 'new';
  appliesFrom: number;
  targets: Record<FitKind, boolean>;
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

export const FOCUS_POSITION: Record<FitFocus, string> = {
  center: '50% 50%',
  top: '50% 0%',
  bottom: '50% 100%',
  left: '0% 50%',
  right: '100% 50%',
  'top-left': '0% 0%',
  'top-right': '100% 0%',
  'bottom-left': '0% 100%',
  'bottom-right': '100% 100%',
};

/** Sunucudan gelen/bozuk veriyi güvenli bir ayara çevirir. */
export function parseImageFit(raw: unknown): ImageFitConfig {
  const src = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const d = DEFAULT_IMAGE_FIT;
  const t = (src.targets && typeof src.targets === 'object' ? src.targets : {}) as Record<string, unknown>;
  const padding = Number(src.padding);
  const from = Number(src.appliesFrom);
  const oneOf = <T extends string>(list: readonly T[], v: unknown, fb: T): T =>
    typeof v === 'string' && (list as readonly string[]).includes(v) ? (v as T) : fb;
  return {
    enabled: src.enabled === true,
    mode: oneOf(['cover', 'contain'], src.mode, d.mode),
    focus: oneOf(Object.keys(FOCUS_POSITION) as FitFocus[], src.focus, d.focus),
    fill: oneOf(['theme', 'blur', 'white', 'black', 'color'], src.fill, d.fill),
    color: typeof src.color === 'string' && /^#[0-9a-fA-F]{6}$/.test(src.color) ? src.color : d.color,
    padding: Number.isFinite(padding) ? Math.min(16, Math.max(0, Math.round(padding))) : d.padding,
    scope: src.scope === 'new' ? 'new' : 'all',
    appliesFrom: Number.isFinite(from) && from > 0 ? from : 0,
    targets: { products: t.products !== false, groups: t.groups !== false, showcase: t.showcase !== false },
  };
}

/** Resmin adresinden karşılaştırma anahtarı: kaynak ve sorgu atılır, yalnızca yol kalır. */
export function fitKey(src: string): string {
  try {
    return decodeURIComponent(new URL(src, window.location.href).pathname).toLowerCase();
  } catch {
    return src.toLowerCase();
  }
}

/** Yüklenen dosyanın adındaki zaman damgası (sunucu `<ms>-<rastgele>.<uzantı>` biçiminde kaydeder). */
export function uploadedAt(src: string): number {
  const m = /\/(\d{13})-[^/]*$/.exec(fitKey(src));
  return m ? Number(m[1]) : 0;
}

export function fitApplies(cfg: ImageFitConfig, kind: FitKind, src: string): boolean {
  if (!cfg.enabled || !cfg.targets[kind]) return false;
  if (cfg.scope === 'all') return true;
  const at = uploadedAt(src);
  return at > 0 && at >= cfg.appliesFrom;
}

/** Önizleme için React stili (gerçek menüde aynı değerler gözlemci ile uygulanır). */
export function fitStyle(cfg: ImageFitConfig, blurSource = false): CSSProperties {
  const contain = cfg.mode === 'contain';
  const fillColor = cfg.fill === 'white' ? '#ffffff' : cfg.fill === 'black' ? '#000000' : cfg.fill === 'color' ? cfg.color : undefined;
  return {
    objectFit: cfg.mode,
    objectPosition: FOCUS_POSITION[cfg.focus],
    ...(contain && cfg.padding ? { padding: `${cfg.padding}%`, boxSizing: 'border-box' as const } : {}),
    ...(contain && fillColor && !blurSource ? { backgroundColor: fillColor } : {}),
  };
}

const PROPS = ['object-fit', 'object-position', 'padding', 'box-sizing', 'background-color', 'position', 'z-index'] as const;

function clear(img: HTMLImageElement) {
  for (const p of PROPS) img.style.removeProperty(p);
  // Uygulamadan önceki satır içi stilleri geri yükle.
  try {
    const orig = JSON.parse(img.dataset.imgfitOrig || '{}') as Record<string, [string, string]>;
    for (const [p, [v, pr]] of Object.entries(orig)) img.style.setProperty(p, v, pr);
  } catch {
    /* geri yüklenecek bir şey yok */
  }
  delete img.dataset.imgfitOrig;
  delete img.dataset.imgfit;
  const parent = img.parentElement;
  if (parent?.classList.contains('imgfit-blur')) {
    parent.classList.remove('imgfit-blur');
    parent.style.removeProperty('--imgfit-src');
    if (parent.dataset.imgfitPos) {
      parent.style.removeProperty('position');
      delete parent.dataset.imgfitPos;
    }
  }
}

function apply(img: HTMLImageElement, cfg: ImageFitConfig) {
  const s = img.style;
  if (!img.dataset.imgfitOrig) {
    const orig: Record<string, [string, string]> = {};
    for (const p of PROPS) {
      const v = s.getPropertyValue(p);
      if (v) orig[p] = [v, s.getPropertyPriority(p)];
    }
    img.dataset.imgfitOrig = JSON.stringify(orig);
  }
  const contain = cfg.mode === 'contain';
  s.setProperty('object-fit', cfg.mode, 'important');
  s.setProperty('object-position', FOCUS_POSITION[cfg.focus], 'important');
  if (contain && cfg.padding) {
    s.setProperty('padding', `${cfg.padding}%`, 'important');
    s.setProperty('box-sizing', 'border-box', 'important');
  } else {
    s.removeProperty('padding');
  }
  const solid = cfg.fill === 'white' ? '#ffffff' : cfg.fill === 'black' ? '#000000' : cfg.fill === 'color' ? cfg.color : '';
  if (contain && solid) s.setProperty('background-color', solid, 'important');
  else s.removeProperty('background-color');

  // Bulanık dolgu: tek resimli kutularda, resmin kendisi arkada bulanık gösterilir.
  const parent = img.parentElement;
  const blur = contain && cfg.fill === 'blur' && parent && parent.querySelectorAll('img').length === 1;
  if (blur && parent) {
    if (!parent.classList.contains('imgfit-blur')) {
      if (getComputedStyle(parent).position === 'static') {
        parent.style.position = 'relative';
        parent.dataset.imgfitPos = '1';
      }
      parent.classList.add('imgfit-blur');
    }
    parent.style.setProperty('--imgfit-src', `url("${(img.currentSrc || img.src).replace(/"/g, '%22')}")`);
    if (getComputedStyle(img).position === 'static') s.setProperty('position', 'relative');
    s.setProperty('z-index', '1');
  } else if (parent?.classList.contains('imgfit-blur')) {
    parent.classList.remove('imgfit-blur');
    parent.style.removeProperty('--imgfit-src');
  }
  img.dataset.imgfit = '1';
}

/**
 * Sayfadaki uygun resimlere ayarı uygular; yeni gelen/değişen resimleri de izler.
 * Hangi resmin hangi türde olduğunu `kindOf` söyler (null = dokunma).
 */
export function startImageFit(cfg: ImageFitConfig, kindOf: (img: HTMLImageElement) => FitKind | null): () => void {
  const sig = JSON.stringify(cfg);
  let frame = 0;
  const scan = () => {
    frame = 0;
    document.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.src;
      if (!src) return;
      const mark = `${sig}|${src}`;
      if (img.dataset.imgfitSig === mark) return;
      img.dataset.imgfitSig = mark;
      const kind = kindOf(img);
      if (kind && fitApplies(cfg, kind, src)) apply(img, cfg);
      else if (img.dataset.imgfit) clear(img);
    });
  };
  const queue = () => {
    if (!frame) frame = requestAnimationFrame(scan);
  };
  const observer = new MutationObserver(queue);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['src', 'srcset'] });
  document.addEventListener('load', queue, true);
  scan();
  return () => {
    observer.disconnect();
    document.removeEventListener('load', queue, true);
    if (frame) cancelAnimationFrame(frame);
    document.querySelectorAll<HTMLImageElement>('img').forEach((img) => {
      delete img.dataset.imgfitSig;
      if (img.dataset.imgfit) clear(img);
    });
  };
}

/** Menü verisindeki tüm görselleri türleriyle toplar (ürün/grup/vitrin). */
export function collectMenuImages(menu: unknown): { url: string; kind: FitKind }[] {
  const out: { url: string; kind: FitKind }[] = [];
  const seen = new Set<unknown>();
  const walk = (node: unknown, kind: FitKind) => {
    if (!node || typeof node !== 'object' || seen.has(node)) return;
    seen.add(node);
    if (Array.isArray(node)) return node.forEach((n) => walk(n, kind));
    const o = node as Record<string, unknown>;
    const isProduct = 'price' in o;
    const k: FitKind = isProduct ? 'products' : kind;
    if (typeof o.imageUrl === 'string' && o.imageUrl) out.push({ url: o.imageUrl, kind: k });
    if (Array.isArray(o.images)) for (const u of o.images) if (typeof u === 'string' && u) out.push({ url: u, kind: 'products' });
    for (const key of ['products', 'groups', 'children', 'subGroups', 'items']) if (o[key]) walk(o[key], key === 'products' ? 'products' : 'groups');
  };
  const m = (menu && typeof menu === 'object' ? menu : {}) as Record<string, unknown>;
  walk(m.groups, 'groups');
  walk(m.showcase, 'showcase');
  walk(m.stories, 'showcase');
  return out;
}

/** Yönetim panelinde bir resmin hangi türe ait olduğunu bulunduğu alandan anlar. */
export function adminKindOf(img: HTMLImageElement): FitKind | null {
  if (img.closest('[data-no-fit]')) return null;
  if (img.closest('.aga-thumb, .ap-page .ap-table, .pe-editor, .product-modal-shell, .admin-overlay--product')) return 'products';
  if (img.closest('.apg, .ag-page')) return 'groups';
  if (img.closest('.sc-page')) return 'showcase';
  if (img.closest('.ap-page')) return 'products';
  return null;
}

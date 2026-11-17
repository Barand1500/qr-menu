/** Shared model + helpers of the Barkod Yazdır page. Stored styles keep their original shape. */
export type Mode = 'classic' | 'tables' | 'campaign';

export const QR_COLORS = [
  { id: 'black', fg: '#0f172a', bg: '#ffffff', label: 'Siyah' },
  { id: 'navy', fg: '#1e3a5f', bg: '#f8fafc', label: 'Lacivert' },
  { id: 'ocean', fg: '#0369a1', bg: '#f0f9ff', label: 'Okyanus' },
  { id: 'sky', fg: '#0284c7', bg: '#e0f2fe', label: 'Gök mavisi' },
  { id: 'teal', fg: '#0f766e', bg: '#f0fdfa', label: 'Turkuaz' },
  { id: 'forest', fg: '#14532d', bg: '#f0fdf4', label: 'Yeşil' },
  { id: 'emerald', fg: '#047857', bg: '#ecfdf5', label: 'Zümrüt' },
  { id: 'wine', fg: '#7f1d1d', bg: '#fff1f2', label: 'Bordo' },
  { id: 'rose', fg: '#be123c', bg: '#fff1f2', label: 'Gül' },
  { id: 'coral', fg: '#c2410c', bg: '#fff7ed', label: 'Mercan' },
  { id: 'gold', fg: '#78350f', bg: '#fffbeb', label: 'Altın' },
  { id: 'amber', fg: '#b45309', bg: '#fffbeb', label: 'Amber' },
  { id: 'purple', fg: '#5b21b6', bg: '#f5f3ff', label: 'Mor' },
  { id: 'slate', fg: '#475569', bg: '#f8fafc', label: 'Gri' },
] as const;

export const QR_FRAMES = [
  { id: 'yok', label: 'Yok' },
  { id: 'ince', label: 'İnce' },
  { id: 'kalin', label: 'Kalın' },
  { id: 'kelebek', label: 'Kelebek' },
  { id: 'kesik', label: 'Kesik' },
  { id: 'halka', label: 'Halka' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'sarma', label: 'Sarmaşık' },
] as const;
export type FrameId = (typeof QR_FRAMES)[number]['id'];

export const TEMPLATES = [
  { id: 'klasik', label: 'Klasik', hint: 'Başlık, QR, çağrı' },
  { id: 'afis', label: 'Afiş', hint: 'Renkli başlık bandı' },
  { id: 'sade', label: 'Sade', hint: 'Büyük QR, az yazı' },
] as const;
export type TemplateId = (typeof TEMPLATES)[number]['id'];

export const PAPERS = [
  { id: 'a4', label: 'A4', w: 210, h: 297, margin: 8, sheet: true },
  { id: 'a5', label: 'A5', w: 148, h: 210, margin: 6, sheet: true },
  { id: '80mm', label: '80 mm', w: 80, h: 0, margin: 2, sheet: false },
  { id: '58mm', label: '58 mm', w: 58, h: 0, margin: 2, sheet: false },
] as const;
export type PaperId = (typeof PAPERS)[number]['id'];

export const PER_PAGE = [1, 2, 4, 6, 9] as const;
export const CARD_RATIO = 4 / 3;

export type TableGroup = {
  id: string;
  name: string;
  count: number;
  prefix: string;
};
export type TableStyle = {
  name: string;
  colorId: string;
  withLogo: boolean;
  frameId: FrameId;
};
export type GroupStyles = Record<string, Record<number, TableStyle>>;
export type CampaignRow = {
  id: number;
  name: string;
  slug: string;
  itemCount: number;
};

/** Look shared by the plain QR and campaign cards; tables carry their own colour/frame/logo. */
export type Design = {
  colorId: string;
  withLogo: boolean;
  frameId: FrameId;
  template: TemplateId;
  cta: string;
  showUrl: boolean;
};
export const DEFAULT_CTA = 'Menüyü görmek için okutun';
export const DEFAULT_DESIGN: Design = {
  colorId: 'black',
  withLogo: false,
  frameId: 'yok',
  template: 'klasik',
  cta: DEFAULT_CTA,
  showUrl: true,
};

export type CardSpec = {
  key: string;
  title: string;
  subtitle: string;
  url: string;
  fg: string;
  bg: string;
  logo?: string;
  frameId: FrameId;
  template: TemplateId;
  cta: string;
  showUrl: boolean;
};

export function slugify(text: string) {
  return text
    .toLowerCase()
    .trim()
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ı/g, 'i')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
export const normalizePrefix = (value: string) => value.trim().slice(0, 20);
export function tableCode(n: number, prefix = '') {
  const p = normalizePrefix(prefix);
  return p ? `${p}-${n}` : String(n);
}
export function defaultTableStyle(
  n: number,
  groupName = 'Masa',
  prefix = '',
): TableStyle {
  const p = normalizePrefix(prefix);
  return {
    name: p ? `${p}-${n}` : `${groupName} ${n}`,
    colorId: 'black',
    withLogo: false,
    frameId: 'yok',
  };
}
export function normalizeHex(value: string): string | null {
  const v = value.trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(v)) return v;
  if (/^#[0-9a-f]{3}$/.test(v))
    return `#${v[1]}${v[1]}${v[2]}${v[2]}${v[3]}${v[3]}`;
  return null;
}
function softBgFromFg(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
  const mix = (c: number) => Math.round(c * 0.1 + 255 * 0.9);
  return `rgb(${mix(r)}, ${mix(g)}, ${mix(b)})`;
}
export function resolveColor(colorId: string) {
  const preset = QR_COLORS.find((c) => c.id === colorId);
  if (preset) return preset;
  const fg = normalizeHex(colorId) || '#0f172a';
  return { id: 'custom', fg, bg: softBgFromFg(fg), label: 'Özel' };
}
export const isFrame = (id: unknown): id is FrameId =>
  QR_FRAMES.some((f) => f.id === id);

/** Table style with defaults filled in. Auto-generated names follow the group name/prefix. */
export function readTableStyle(
  group: TableGroup,
  styles: GroupStyles,
  n: number,
): TableStyle {
  const base = defaultTableStyle(n, group.name, group.prefix);
  const saved = styles[group.id]?.[n];
  if (!saved) return base;
  const auto =
    !saved.name || saved.name === String(n) || saved.name === base.name;
  return {
    ...base,
    ...saved,
    name: auto ? base.name : saved.name,
    frameId: isFrame(saved.frameId) ? saved.frameId : base.frameId,
  };
}

/** Geometry of one printed card, in millimetres. */
export function sheetLayout(paperId: PaperId, perPage: number) {
  const paper = PAPERS.find((p) => p.id === paperId) || PAPERS[0];
  const gap = 4;
  if (!paper.sheet) {
    const w = paper.w - paper.margin * 2;
    return {
      paper,
      cols: 1,
      rows: 1,
      per: 1,
      gap,
      cardW: w,
      cardH: w * CARD_RATIO,
      pageH: w * CARD_RATIO + paper.margin * 2,
    };
  }
  const per = (PER_PAGE as readonly number[]).includes(perPage) ? perPage : 1;
  const cols =
    per === 1 ? 1 : per === 2 ? 1 : per === 4 ? 2 : per === 6 ? 2 : 3;
  const rows = per / cols;
  const cellW = (paper.w - paper.margin * 2 - gap * (cols - 1)) / cols;
  const cellH = (paper.h - paper.margin * 2 - gap * (rows - 1)) / rows;
  const cardW = Math.min(cellW, cellH / CARD_RATIO);
  return {
    paper,
    cols,
    rows,
    per,
    gap,
    cardW,
    cardH: cardW * CARD_RATIO,
    pageH: paper.h,
  };
}

export const DESIGN_KEY = 'menu-qr-barcode-design-v2';
export const GROUPS_KEY = 'menu-qr-barcode-table-groups';
export function loadDesign(): Design {
  try {
    const raw = JSON.parse(localStorage.getItem(DESIGN_KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT_DESIGN;
    return {
      colorId:
        typeof raw.colorId === 'string' ? raw.colorId : DEFAULT_DESIGN.colorId,
      withLogo: Boolean(raw.withLogo),
      frameId: isFrame(raw.frameId) ? raw.frameId : 'yok',
      template: TEMPLATES.some((t) => t.id === raw.template)
        ? raw.template
        : 'klasik',
      cta: typeof raw.cta === 'string' ? raw.cta.slice(0, 60) : DEFAULT_CTA,
      showUrl: raw.showUrl !== false,
    };
  } catch {
    return DEFAULT_DESIGN;
  }
}
export function loadTableGroups(): {
  groups: TableGroup[];
  activeGroupId: string;
  styles: GroupStyles;
} {
  const fallback = {
    groups: [
      { id: 'salon', name: 'Salon', count: 12, prefix: '' },
      { id: 'teras', name: 'Teras', count: 8, prefix: '' },
    ],
    activeGroupId: 'salon',
    styles: {} as GroupStyles,
  };
  try {
    const parsed = JSON.parse(localStorage.getItem(GROUPS_KEY) || 'null');
    if (!parsed?.groups?.length) return fallback;
    const groups: TableGroup[] = parsed.groups.map((g: TableGroup) => ({
      id: g.id,
      name: g.name,
      count: g.count,
      prefix: normalizePrefix(g.prefix || ''),
    }));
    return {
      groups,
      activeGroupId: groups.some((g) => g.id === parsed.activeGroupId)
        ? parsed.activeGroupId
        : groups[0].id,
      styles: parsed.groupStyles || {},
    };
  } catch {
    return fallback;
  }
}

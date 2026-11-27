/**
 * Vega Şefim → QR menü eşitlemesinin saf mantığı (veritabanı yok, testli).
 * Ayrıntılı kurallar: docs/sefim-entegrasyon/YOL-HARITASI.md bölüm 5.
 */
import type { ProductOptionGroup } from './product-options.js';

// ───────────── Görüntü (Çırak'tan gelen veri) ─────────────
export type SnapItem = { id: number; name: string; price: number; order: number };
export type SnapChoice = SnapItem & { subs: SnapItem[] };
export type SnapOptionCat = { id: string; name: string; min: number; max: number; order: number; items: { id: string; name: string; price: number; order: number }[] };
/** Şablon fiyatı: t = şablon, c1/c2 = porsiyon (0 = ürünün kendisi) */
export type SnapTplPrice = { t: number; c1: number; c2: number; p: number };
export type SnapProduct = {
  id: number;
  name: string;
  group: string;
  price: number;
  vat: number;
  code: string;
  order: number;
  choices: SnapChoice[];
  options: SnapOptionCat[];
  tpl: SnapTplPrice[];
};
export type Snapshot = {
  groups: { name: string; count: number }[];
  templates: { id: number; name: string }[];
  products: SnapProduct[];
  /** Çırak'ın teşhis notları (ör. Options sütunları bulunamadı) */
  notes: string[];
  /** Görüntü hangi gruplar için çekildi (null = varsayılan kural) */
  scope: string[] | null;
};

export const MAX_PRODUCTS = 5000;
const MAX_NAME = 150;

const str = (v: unknown, max = MAX_NAME) => String(v ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const money = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) / 100 : 0;
};
const int = (v: unknown) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const obj = (v: unknown): Record<string, unknown> => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {});

function parseItem(raw: unknown): SnapItem | null {
  const r = obj(raw);
  const name = str(r.name, 80);
  if (!name) return null;
  return { id: int(r.id), name, price: money(r.price), order: int(r.order) };
}

/** Gelen görüntüyü doğrular ve sınırlar. Bozuk satırlar atlanır, hata fırlatılmaz. */
export function parseSnapshot(raw: unknown): Snapshot {
  const r = obj(raw);
  const products: SnapProduct[] = [];
  const seen = new Set<number>();
  for (const row of arr(r.products)) {
    if (products.length >= MAX_PRODUCTS) break;
    const p = obj(row);
    const id = int(p.id);
    const name = str(p.name);
    const group = str(p.group, 190);
    if (!id || !name || !group || seen.has(id)) continue;
    seen.add(id);
    products.push({
      id,
      name,
      group,
      price: money(p.price),
      vat: money(p.vat),
      code: str(p.code, 60),
      order: int(p.order),
      choices: arr(p.choices)
        .map((c) => {
          const it = parseItem(c);
          return it ? { ...it, subs: arr(obj(c).subs).map(parseItem).filter(Boolean).slice(0, 60) as SnapItem[] } : null;
        })
        .filter(Boolean)
        .slice(0, 60) as SnapChoice[],
      options: arr(p.options)
        .map((c) => {
          const o = obj(c);
          const name = str(o.name, 80);
          const items = arr(o.items)
            .map((x) => {
              const i = obj(x);
              const n = str(i.name, 80);
              return n ? { id: str(i.id, 40) || n, name: n, price: money(i.price), order: int(i.order) } : null;
            })
            .filter(Boolean)
            .slice(0, 80) as SnapOptionCat['items'];
          return name && items.length ? { id: str(o.id, 40) || name, name, min: Math.max(0, int(o.min)), max: Math.max(0, int(o.max)), order: int(o.order), items } : null;
        })
        .filter(Boolean)
        .slice(0, 20) as SnapOptionCat[],
      tpl: arr(p.tpl)
        .map((x) => {
          const t = obj(x);
          return { t: int(t.t), c1: int(t.c1), c2: int(t.c2), p: money(t.p) };
        })
        .filter((t) => t.t > 0)
        .slice(0, 200),
    });
  }
  const groups = arr(r.groups)
    .map((g) => ({ name: str(obj(g).name, 190), count: Math.max(0, int(obj(g).count)) }))
    .filter((g) => g.name)
    .slice(0, 500);
  const templates = arr(r.templates)
    .map((t) => ({ id: int(obj(t).id), name: str(obj(t).name, 80) }))
    .filter((t) => t.id > 0 && t.name)
    .slice(0, 50);
  const notes = arr(r.notes).map((n) => str(n, 300)).filter(Boolean).slice(0, 20);
  const scope = Array.isArray(r.scope) ? arr(r.scope).map((g) => str(g, 190)).filter(Boolean) : null;
  return { groups, templates, products, notes, scope };
}

// ───────────── Ayarlar ─────────────
export type SyncMode = 'sync' | 'addOnly' | 'priceOnly';
export type SefimSettings = {
  /** Kapalıysa görüntü saklanır ama menüye dokunulmaz */
  enabled: boolean;
  mode: SyncMode;
  /** 'base' = Şefim ana (masa) fiyatı, 't:<id>' = fiyat şablonu */
  price: string;
  /** null = sistem grupları hariç hepsi */
  groups: string[] | null;
  fields: { name: boolean; price: boolean; group: boolean; options: boolean };
  removed: 'hide' | 'keep';
  matchByName: boolean;
  newVisible: boolean;
  tidyNames: boolean;
  autoApply: boolean;
};

export const DEFAULT_SETTINGS: SefimSettings = {
  enabled: true,
  mode: 'sync',
  price: 'base',
  groups: null,
  fields: { name: true, price: true, group: true, options: true },
  removed: 'hide',
  matchByName: true,
  newVisible: true,
  tidyNames: true,
  autoApply: true,
};

export function normalizeSettings(raw: unknown): SefimSettings {
  const r = obj(raw);
  const f = obj(r.fields);
  const d = DEFAULT_SETTINGS;
  const bool = (v: unknown, def: boolean) => (typeof v === 'boolean' ? v : def);
  return {
    enabled: bool(r.enabled, d.enabled),
    mode: r.mode === 'addOnly' || r.mode === 'priceOnly' ? r.mode : 'sync',
    price: typeof r.price === 'string' && /^(base|t:\d{1,9})$/.test(r.price) ? r.price : 'base',
    groups: Array.isArray(r.groups) ? [...new Set(arr(r.groups).map((g) => str(g, 190)).filter(Boolean))].slice(0, 500) : null,
    fields: { name: bool(f.name, true), price: bool(f.price, true), group: bool(f.group, true), options: bool(f.options, true) },
    removed: r.removed === 'keep' ? 'keep' : 'hide',
    matchByName: bool(r.matchByName, d.matchByName),
    newVisible: bool(r.newVisible, d.newVisible),
    tidyNames: bool(r.tidyNames, d.tidyNames),
    autoApply: bool(r.autoApply, d.autoApply),
  };
}

/** `$Trendyol`, `$KUVER`, `[R]Rezervasyon` gibi Şefim'in kendi açtığı gruplar */
export const isSystemGroup = (name: string) => /^\s*(\$|\[r\])/i.test(name);

export function wantedGroups(settings: SefimSettings, groups: { name: string }[]): string[] {
  if (settings.groups) return settings.groups;
  return groups.map((g) => g.name).filter((n) => !isSystemGroup(n));
}

// ───────────── İsimler ─────────────
const tr = (s: string) => s.toLocaleLowerCase('tr-TR');
export const normName = (s: string) => tr(s).replace(/[\s.]+/g, ' ').trim();
const UNITS = new Set(['gr', 'g', 'ml', 'cl', 'lt', 'l', 'kg', 'cm', 'adet']);
const SMALL = new Set(['ve', 'ile', 'veya', 'de', 'da']);

/**
 * Büyük harfle yazılmış yabancı kelimelerde "I" aslında "i"dir (PIZZA → pizza, pızza değil).
 * Türkçe kelimelerde ise "ı" doğrudur (KARIŞIK → karışık). Sık geçenler elle düzeltilir.
 */
const FOREIGN: Record<string, string> = {
  pızza: 'pizza', pızzalar: 'pizzalar', chıcken: 'chicken', mılk: 'milk', mılkshake: 'milkshake', tıramısu: 'tiramisu', mıx: 'mix', fıt: 'fit',
  ıce: 'ice', whıte: 'white', dıp: 'dip', lıme: 'lime', bıg: 'big', kıds: 'kids', kıd: 'kid', wıngs: 'wings', chılı: 'chili', frıes: 'fries',
  macchıato: 'macchiato', crıspy: 'crispy', onıon: 'onion', rıngs: 'rings', spaghettı: 'spaghetti', spagettı: 'spagetti', panını: 'panini',
  latte: 'latte', ıced: 'iced', cookıe: 'cookie', brownıe: 'brownie', smoothıe: 'smoothie', wrap: 'wrap', tea: 'tea', mını: 'mini', maxı: 'maxi', fıleto: 'fileto',
};

/** "KLASİK DÜRÜMLER" → "Klasik Dürümler". Küçük harf içeren adlara dokunmaz. */
export function tidyName(s: string): string {
  if (!/\p{Lu}/u.test(s) || /\p{Ll}/u.test(s)) return s;
  let first = true;
  return s.replace(/\p{L}+/gu, (w) => {
    let low = tr(w);
    const foreign = FOREIGN[low];
    if (foreign) low = foreign;
    const head = foreign ? low.charAt(0).toUpperCase() : low.charAt(0).toLocaleUpperCase('tr-TR');
    const out = (!first && SMALL.has(low)) || UNITS.has(low) ? low : head + low.slice(1);
    first = false;
    return out;
  });
}

// ───────────── Seçenekler ─────────────
const SIZE_RE = /(\d+\s*(gr|g|ml|cl|lt|l|kg|cm)\b)|küçük|orta|büyük|porsiyon|boy|duble|tek\b|yarım|tam\b/i;

/** Şefim'den gelen seçenek grubu kimlikleri `sf_` ile başlar; restoranın kendi eklediklerine dokunulmaz. */
export const isSefimGroupId = (id: string) => id.startsWith('sf_');

function tplPrice(p: SnapProduct, t: number | null, c1: number, c2: number, fallback: number) {
  if (t == null) return fallback;
  const hit = p.tpl.find((x) => x.t === t && x.c1 === c1 && x.c2 === c2);
  return hit ? hit.p : fallback;
}

function singleGroup(id: string, name: string, items: { id: string; name: string; price: number; order: number }[], sort: number): ProductOptionGroup {
  const allPriced = items.length > 0 && items.every((i) => i.price > 0);
  return {
    id,
    name,
    type: 'single',
    pricing: allPriced ? 'replace' : 'add',
    required: true,
    sortOrder: sort,
    maxTotalQty: 0,
    options: items
      .slice()
      .sort((a, b) => a.order - b.order)
      .map((i, n) => ({ id: i.id, name: i.name, price: i.price, isActive: true, sortOrder: n, excludesOptionIds: [], limitsMultiMaxTotalQty: 0, stockQty: null })),
  };
}

/** Bir Şefim ürününün menüdeki fiyatı ve seçenek grupları. */
export function productShape(p: SnapProduct, settings: Pick<SefimSettings, 'price' | 'tidyNames'>): { price: number; optionGroups: ProductOptionGroup[] } {
  const t = settings.price.startsWith('t:') ? Number(settings.price.slice(2)) : null;
  const nm = (s: string) => (settings.tidyNames ? tidyName(s) : s);
  const groups: ProductOptionGroup[] = [];
  const flat = p.choices.filter((c) => !c.subs.length);
  if (flat.length) {
    const items = flat.map((c) => ({ id: `sf_c1_${c.id}`, name: nm(c.name), price: tplPrice(p, t, c.id, 0, c.price), order: c.order }));
    groups.push(singleGroup(`sf_p_${p.id}`, flat.some((c) => SIZE_RE.test(c.name)) ? 'Porsiyon' : 'Çeşit', items, groups.length));
  }
  for (const c of p.choices.filter((c) => c.subs.length)) {
    const items = c.subs.map((s) => ({ id: `sf_c2_${s.id}`, name: nm(s.name), price: tplPrice(p, t, c.id, s.id, s.price), order: s.order }));
    groups.push(singleGroup(`sf_c1_${c.id}`, nm(c.name), items, groups.length));
  }
  for (const cat of p.options.slice().sort((a, b) => a.order - b.order)) {
    groups.push({
      id: `sf_oc_${cat.id}`,
      name: nm(cat.name),
      type: 'choice',
      pricing: 'add',
      required: cat.min > 0,
      sortOrder: groups.length,
      maxTotalQty: 0,
      options: cat.items
        .slice()
        .sort((a, b) => a.order - b.order)
        .map((i, n) => ({ id: `sf_o_${i.id}`, name: nm(i.name), price: i.price, isActive: true, sortOrder: n, excludesOptionIds: [], limitsMultiMaxTotalQty: 0, stockQty: null })),
    });
  }
  let price = tplPrice(p, t, 0, 0, p.price);
  const replace = groups.find((g) => g.pricing === 'replace');
  if (price <= 0 && replace) price = Math.min(...replace.options.map((o) => o.price));
  return { price, optionGroups: groups };
}

/**
 * Şefim gruplarını restoranın kendi gruplarıyla birleştirir:
 * restoranın eklediği gruplar yerinde kalır, Şefim grupları yenilenir.
 * Aynı kimlikli seçeneğin restoranda verilmiş stok/aktiflik bilgisi korunur.
 */
export function mergeOptionGroups(local: ProductOptionGroup[], fromSefim: ProductOptionGroup[]): ProductOptionGroup[] {
  const prev = new Map(local.filter((g) => isSefimGroupId(g.id)).flatMap((g) => g.options.map((o) => [o.id, o] as const)));
  const sefim = fromSefim.map((g) => ({
    ...g,
    options: g.options.map((o) => {
      const old = prev.get(o.id);
      return old ? { ...o, isActive: old.isActive, stockQty: old.stockQty } : o;
    }),
  }));
  const own = local.filter((g) => !isSefimGroupId(g.id));
  return [...sefim, ...own].map((g, i) => ({ ...g, sortOrder: i }));
}

/** Sadece fiyat modu: var olan Şefim seçeneklerinin yalnızca fiyatını tazeler. */
function refreshOptionPrices(local: ProductOptionGroup[], fromSefim: ProductOptionGroup[]): ProductOptionGroup[] {
  const price = new Map(fromSefim.flatMap((g) => g.options.map((o) => [o.id, o.price] as const)));
  return local.map((g) => (isSefimGroupId(g.id) ? { ...g, options: g.options.map((o) => (price.has(o.id) ? { ...o, price: price.get(o.id)! } : o)) } : g));
}

const sameGroups = (a: ProductOptionGroup[], b: ProductOptionGroup[]) => JSON.stringify(a) === JSON.stringify(b);

// ───────────── Plan ─────────────
export type LocalGroup = { id: number; name: string };
export type LocalProduct = { id: number; groupId: number; name: string; price: number; isActive: boolean; optionGroups: ProductOptionGroup[] };
export type MapRow = { kind: 'product' | 'group'; sefimKey: string; localId: number; sefimGroup: string | null; hiddenBySync: boolean };

export type Op =
  | { k: 'group'; key: string; name: string }
  | { k: 'linkGroup'; key: string; localId: number; name: string }
  | { k: 'create'; sid: number; sefimGroup: string; groupKey: string; name: string; price: number; optionGroups: ProductOptionGroup[]; active: boolean; order: number }
  | { k: 'link'; sid: number; sefimGroup: string; localId: number; name: string }
  | {
      k: 'update';
      sid: number;
      localId: number;
      name: string;
      set: { name?: string; price?: number; groupKey?: string; optionGroups?: ProductOptionGroup[] };
      from: { name?: string; price?: number; group?: string };
      to: { group?: string };
    }
  | { k: 'hide'; sid: number; localId: number; name: string }
  | { k: 'show'; sid: number; localId: number; name: string };

export type PlanSummary = { create: number; update: number; price: number; link: number; hide: number; show: number; groups: number; same: number; total: number };
export type Plan = { ops: Op[]; summary: PlanSummary; warnings: string[]; regroup: { sid: number; group: string }[] };

export type PlanInput = { snapshot: Snapshot; settings: SefimSettings; groups: LocalGroup[]; products: LocalProduct[]; maps: MapRow[] };

/** Ne eklenecek / güncellenecek / gizlenecek — hiçbir şeyi değiştirmeden hesaplar. */
export function planSync({ snapshot, settings, groups, products, maps }: PlanInput): Plan {
  const ops: Op[] = [];
  const warnings: string[] = [];
  const regroup: Plan['regroup'] = [];
  const wanted = new Set(wantedGroups(settings, snapshot.groups));
  const items = snapshot.products.filter((p) => wanted.has(p.group));
  const nm = (s: string) => (settings.tidyNames ? tidyName(s) : s);
  const canCreate = settings.mode !== 'priceOnly';

  const localGroup = new Map(groups.map((g) => [g.id, g]));
  const localProduct = new Map(products.map((p) => [p.id, p]));
  const groupMap = new Map(maps.filter((m) => m.kind === 'group' && localGroup.has(m.localId)).map((m) => [m.sefimKey, m]));
  const productMap = new Map(maps.filter((m) => m.kind === 'product' && localProduct.has(m.localId)).map((m) => [m.sefimKey, m]));
  const takenLocal = new Set([...productMap.values()].map((m) => m.localId));

  // Gruplar: eş → aynı adlı grup → yeni grup
  const groupRef = new Map<string, { localId: number | null; name: string }>();
  const groupByName = new Map<string, LocalGroup>();
  for (const g of groups) if (!groupByName.has(normName(g.name))) groupByName.set(normName(g.name), g);
  const needGroup = (key: string) => {
    if (groupRef.has(key)) return groupRef.get(key)!;
    const mapped = groupMap.get(key);
    let ref: { localId: number | null; name: string };
    if (mapped) ref = { localId: mapped.localId, name: localGroup.get(mapped.localId)!.name };
    else {
      const same = groupByName.get(normName(key)) || groupByName.get(normName(nm(key)));
      if (same) {
        ops.push({ k: 'linkGroup', key, localId: same.id, name: same.name });
        ref = { localId: same.id, name: same.name };
      } else {
        ops.push({ k: 'group', key, name: nm(key) });
        ref = { localId: null, name: nm(key) };
      }
    }
    groupRef.set(key, ref);
    return ref;
  };

  // Aynı adlı (eşi olmayan) ürünler — elle eklenmiş ürünü kopyalamamak için
  const byName = new Map<string, LocalProduct[]>();
  for (const p of products) {
    if (takenLocal.has(p.id)) continue;
    const k = normName(p.name);
    byName.set(k, [...(byName.get(k) || []), p]);
  }

  let same = 0;
  for (const sp of items) {
    const key = String(sp.id);
    const shape = productShape(sp, settings);
    const name = nm(sp.name);
    let map = productMap.get(key);
    let local = map ? localProduct.get(map.localId)! : null;

    if (!local && settings.matchByName) {
      const cands = byName.get(normName(name)) || byName.get(normName(sp.name)) || [];
      const ref = groupMap.get(sp.group);
      const pick = cands.find((c) => ref && c.groupId === ref.localId) || cands[0];
      if (pick) {
        ops.push({ k: 'link', sid: sp.id, sefimGroup: sp.group, localId: pick.id, name: pick.name });
        byName.set(normName(pick.name), (byName.get(normName(pick.name)) || []).filter((c) => c.id !== pick.id));
        takenLocal.add(pick.id);
        local = pick;
        map = { kind: 'product', sefimKey: key, localId: pick.id, sefimGroup: sp.group, hiddenBySync: false };
        if (settings.mode === 'addOnly') continue; // eşleştirildi, dokunulmaz
      }
    }

    if (!local) {
      if (!canCreate) continue;
      needGroup(sp.group);
      ops.push({ k: 'create', sid: sp.id, sefimGroup: sp.group, groupKey: sp.group, name, price: shape.price, optionGroups: shape.optionGroups, active: settings.newVisible, order: sp.order });
      continue;
    }

    if (map && map.sefimGroup !== sp.group) regroup.push({ sid: sp.id, group: sp.group });
    if (map?.hiddenBySync && !local.isActive) ops.push({ k: 'show', sid: sp.id, localId: local.id, name: local.name });
    if (settings.mode === 'addOnly') {
      same++;
      continue;
    }

    const set: Extract<Op, { k: 'update' }>['set'] = {};
    const from: Extract<Op, { k: 'update' }>['from'] = {};
    const to: Extract<Op, { k: 'update' }>['to'] = {};
    if (settings.fields.price && Math.abs(local.price - shape.price) >= 0.005) {
      set.price = shape.price;
      from.price = local.price;
    }
    if (settings.mode === 'sync') {
      if (settings.fields.name && local.name !== name) {
        set.name = name;
        from.name = local.name;
      }
      if (settings.fields.group) {
        const ref = needGroupIfMoved(sp.group, local.groupId);
        if (ref) {
          set.groupKey = sp.group;
          from.group = localGroup.get(local.groupId)?.name || '';
          to.group = ref;
        }
      }
      if (settings.fields.options) {
        const merged = mergeOptionGroups(local.optionGroups, shape.optionGroups);
        if (!sameGroups(merged, local.optionGroups)) set.optionGroups = merged;
      }
    } else if (settings.fields.options && local.optionGroups.some((g) => isSefimGroupId(g.id))) {
      const refreshed = refreshOptionPrices(local.optionGroups, shape.optionGroups);
      if (!sameGroups(refreshed, local.optionGroups)) set.optionGroups = refreshed;
    }
    if (Object.keys(set).length) ops.push({ k: 'update', sid: sp.id, localId: local.id, name: local.name, set, from, to });
    else same++;
  }

  function needGroupIfMoved(key: string, currentGroupId: number): string | null {
    const mapped = groupMap.get(key);
    if (mapped && mapped.localId === currentGroupId) return null;
    const ref = needGroup(key);
    return ref.localId === currentGroupId ? null : ref.name;
  }

  // Şefim'den kalkan ürünler (yalnızca seçili gruplardakiler)
  if (settings.removed === 'hide' && settings.mode !== 'addOnly') {
    const present = new Set(items.map((p) => String(p.id)));
    const gone = [...productMap.values()].filter((m) => m.sefimGroup && wanted.has(m.sefimGroup) && !present.has(m.sefimKey) && !m.hiddenBySync && localProduct.get(m.localId)!.isActive);
    const watched = [...productMap.values()].filter((m) => m.sefimGroup && wanted.has(m.sefimGroup)).length;
    if (gone.length > 5 && gone.length > watched / 2) {
      warnings.push(`Şefim'de ${gone.length} ürün birden kaybolmuş görünüyor. Yanlışlıkla menünüz boşalmasın diye bu ürünler gizlenmedi.`);
    } else {
      for (const m of gone) ops.push({ k: 'hide', sid: Number(m.sefimKey), localId: m.localId, name: localProduct.get(m.localId)!.name });
    }
  }

  if (!items.length && snapshot.products.length === 0 && snapshot.groups.length) warnings.push('Seçili gruplarda Şefim\'den ürün gelmedi.');
  for (const n of snapshot.notes) warnings.push(n);

  const count = (k: Op['k']) => ops.filter((o) => o.k === k).length;
  const summary: PlanSummary = {
    create: count('create'),
    update: ops.filter((o) => o.k === 'update' && (o.set.name !== undefined || o.set.groupKey !== undefined || o.set.optionGroups !== undefined)).length,
    price: ops.filter((o) => o.k === 'update' && o.set.price !== undefined).length,
    link: count('link'),
    hide: count('hide'),
    show: count('show'),
    groups: count('group'),
    same,
    total: items.length,
  };
  return { ops, summary, warnings, regroup };
}

/** Görüntünün değişip değişmediğini anlamak için kararlı özet girdisi. */
export function snapshotKey(s: Snapshot): string {
  return JSON.stringify([s.groups, s.templates, s.products, s.scope]);
}

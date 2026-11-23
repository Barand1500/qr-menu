import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { ownsAddon } from '../addons/ownership.js';
import { prisma } from '../lib/prisma.js';
import {
  findSourceField,
  getGroupName,
  getProductField,
  getRawField,
  getShowcaseTitles,
  isI18nFieldReviewed,
  patchI18nFieldReviewed,
  type GroupI18nEntry,
  type ProductI18nEntry,
  type ShowcaseI18nEntry,
} from '../lib/i18n-json.js';
import { sleep, translateText } from '../lib/translate-service.js';
import { I18N_DICT_KEY, dictSet, hashText, serializeDict } from '../lib/i18n-dict.js';
import { collectDictSources, loadDict, type DictCategory } from '../lib/translatable.js';
import { purgeLanguage } from '../lib/language-cleanup.js';
import {
  SOFRA_DEFAULTS,
  SOFRA_SETTINGS_KEY,
  SOFRA_TEXT_FIELDS,
  normalizeSofraConfig,
  parseSofraConfig,
  type SofraTextField,
} from '../lib/sofra-config.js';

const router = Router();
router.use(authRequired);

const DEFAULT_SOURCE_LANG = 'tr';

export type GapCategory =
  | 'groups'
  | 'products'
  | 'options'
  | 'showcase'
  | 'stories'
  | 'sofra'
  | DictCategory;
type EntityType = 'group' | 'product' | 'showcase' | 'sofra' | 'dict';

export const CATEGORIES: GapCategory[] = [
  'groups',
  'products',
  'options',
  'showcase',
  'stories',
  'sofra',
  'about',
  'contact',
  'reviews',
  'campaigns',
];

export interface BulkGapItem {
  id: string;
  entityType: EntityType;
  entityId: number;
  field: string;
  /** Çeviri sözlüğü anahtarı (entityType === 'dict') */
  key?: string;
  category: GapCategory;
  label: string;
  fieldLabel: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  /** empty: çeviri yok · same_as_source: kaynakla aynı kopya · stale: kaynak metin sonradan değişti */
  reason: 'empty' | 'same_as_source' | 'stale';
}

const FIELD_LABELS: Record<string, string> = {
  name: 'Ad',
  description: 'Açıklama',
  ingredients: 'İçindekiler',
  allergens: 'Alerjenler',
  title1: 'Başlık 1',
  title2: 'Başlık 2',
  welcomeTitle: 'Karşılama başlığı',
  welcomeSubtitle: 'Karşılama alt yazısı',
  enterLabel: 'Menüye giriş düğmesi',
  menuTitle: 'Menü başlığı',
  menuEyebrow: 'Menü üst etiketi',
  footerText: 'Alt yazı',
  sealText: 'Mühür yazısı',
  picksLabel: 'Şefin seçimi etiketi',
};

const PRODUCT_FIELDS = ['name', 'description', 'ingredients', 'allergens'] as const;

async function requireLangPack(req: Parameters<typeof getRestaurantId>[0], res: import('express').Response) {
  const restaurantId = await getRestaurantId(req);
  if (!restaurantId) {
    res.status(401).json({ message: 'Yetkisiz' });
    return null;
  }
  const owned = await ownsAddon(restaurantId, 'lang-pack');
  if (!owned) {
    res.status(403).json({ message: 'Dil Paketi gerekli' });
    return null;
  }
  return restaurantId;
}

async function getOpenAiKey(restaurantId: number) {
  const row = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: 'openai_api_key' } },
  });
  return row?.value?.trim() || null;
}

function parseTargetLang(raw: unknown): string {
  return String(raw || '')
    .toLowerCase()
    .split('-')[0];
}

function rejectSourceAsTarget(targetLang: string, res: import('express').Response): boolean {
  if (!targetLang) {
    res.status(400).json({ message: 'Hedef dil gerekli' });
    return true;
  }
  if (targetLang === DEFAULT_SOURCE_LANG) {
    res.status(400).json({ message: 'Kaynak dil (Türkçe) hedef seçilemez — başka bir dil seçin' });
    return true;
  }
  return false;
}

async function requireActiveTarget(to: string, res: import('express').Response) {
  const active = await prisma.language.findFirst({ where: { code: to, isActive: true } });
  if (!active) {
    res.status(400).json({ message: 'Hedef dil aktif değil' });
    return null;
  }
  return active;
}

type Need = { sourceLang: string; sourceText: string; reason: 'empty' | 'same_as_source' };

/** Kaynağı olan alan için durum: kaynak yoksa null; çeviri tamamsa need = null. */
function inspectField(
  json: unknown,
  targetLang: string,
  field: string,
  preferred: string[],
): { need: Need | null } | null {
  const source = findSourceField<Record<string, unknown>>(json, targetLang, field, preferred);
  if (!source) return null;

  const raw = getRawField<Record<string, unknown>>(json, targetLang, field);
  if (!raw) return { need: { sourceLang: source.lang, sourceText: source.text, reason: 'empty' } };

  // Kaynakla aynı ama toplu çeviride onaylandıysa eksik sayma (Latte→Latte vb.)
  if (raw === source.text && source.lang !== targetLang) {
    if (isI18nFieldReviewed(json, targetLang, field)) return { need: null };
    return { need: { sourceLang: source.lang, sourceText: source.text, reason: 'same_as_source' } };
  }
  return { need: null };
}

type Scan = { items: BulkGapItem[]; totals: Record<GapCategory, number> };

const emptyTotals = (): Record<GapCategory, number> =>
  Object.fromEntries(CATEGORIES.map((c) => [c, 0])) as Record<GapCategory, number>;

async function scan(restaurantId: number, targetLang: string): Promise<Scan> {
  const languages = await prisma.language.findMany({ where: { isActive: true }, orderBy: { id: 'asc' } });
  const preferred = [
    DEFAULT_SOURCE_LANG,
    ...languages.map((l) => l.code).filter((c) => c !== DEFAULT_SOURCE_LANG && c !== targetLang),
  ];
  const items: BulkGapItem[] = [];
  const totals = emptyTotals();

  // ── gruplar
  const groups = await prisma.group.findMany({ where: { restaurantId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  for (const group of groups) {
    const r = inspectField(group.i18n, targetLang, 'name', preferred);
    if (!r) continue;
    totals.groups++;
    if (!r.need) continue;
    items.push({
      id: `group:${group.id}:name`,
      entityType: 'group',
      entityId: group.id,
      field: 'name',
      category: 'groups',
      label: getGroupName(group.i18n, r.need.sourceLang) || `Grup #${group.id}`,
      fieldLabel: FIELD_LABELS.name,
      targetLang,
      ...r.need,
    });
  }

  // ── ürünler
  const products = await prisma.product.findMany({ where: { restaurantId }, orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }] });
  for (const product of products) {
    const display =
      getProductField(product.i18n, 'tr', 'name') ||
      getProductField(product.i18n, preferred[0] || 'tr', 'name') ||
      `Ürün #${product.id}`;
    for (const field of PRODUCT_FIELDS) {
      const r = inspectField(product.i18n, targetLang, field, preferred);
      if (!r) continue;
      totals.products++;
      if (!r.need) continue;
      items.push({
        id: `product:${product.id}:${field}`,
        entityType: 'product',
        entityId: product.id,
        field,
        category: 'products',
        label: display,
        fieldLabel: FIELD_LABELS[field],
        targetLang,
        ...r.need,
      });
    }
  }

  // ── vitrin ve hikâyeler (silinenler hariç)
  const showcases = await prisma.showcaseImage.findMany({
    where: { restaurantId, isDeleted: false },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });
  for (const item of showcases) {
    const category: GapCategory = item.displayType === 'story' ? 'stories' : 'showcase';
    const titles = getShowcaseTitles(item.i18n, preferred.find((c) => c !== targetLang) || 'tr');
    const display = titles.title1 || titles.title2 || item.name || `Vitrin #${item.id}`;
    for (const field of ['title1', 'title2'] as const) {
      const r = inspectField(item.i18n, targetLang, field, preferred);
      if (!r) continue;
      totals[category]++;
      if (!r.need) continue;
      items.push({
        id: `showcase:${item.id}:${field}`,
        entityType: 'showcase',
        entityId: item.id,
        field,
        category,
        label: display,
        fieldLabel: FIELD_LABELS[field],
        targetLang,
        ...r.need,
      });
    }
  }

  // ── Sofra tema metinleri (karşılama ve menü başlıkları)
  const sofraRow = await prisma.setting.findUnique({
    where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
  });
  const sofra = parseSofraConfig(sofraRow?.value);
  const defaultsTarget = (SOFRA_DEFAULTS.texts as Record<string, Partial<Record<SofraTextField, string>>>)[targetLang];
  for (const field of SOFRA_TEXT_FIELDS) {
    const defaultTr = SOFRA_DEFAULTS.texts.tr[field];
    const customTr = (sofra.texts.tr?.[field] ?? '').trim();
    const source = customTr || defaultTr;
    if (!source) continue;
    totals.sofra++;
    const own = (sofra.texts[targetLang]?.[field] ?? '').trim();
    if (own) continue;
    // Hazır varsayılan çeviri (ör. İngilizce) varsa ve Türkçe metin özelleştirilmediyse eksik sayılmaz
    if (defaultsTarget?.[field] && (!customTr || customTr === defaultTr)) continue;
    items.push({
      id: `sofra:${field}`,
      entityType: 'sofra',
      entityId: 0,
      field,
      category: 'sofra',
      label: 'Karşılama ve menü metinleri',
      fieldLabel: FIELD_LABELS[field] || field,
      sourceLang: DEFAULT_SOURCE_LANG,
      sourceText: source,
      targetLang,
      reason: 'empty',
    });
  }

  // ── çeviri sözlüğü: hakkında, iletişim, yorumlar, seçenekler, kampanyalar
  const [sources, dict] = await Promise.all([collectDictSources(restaurantId), loadDict(restaurantId)]);
  for (const src of sources) {
    totals[src.category]++;
    const entry = dict[src.key]?.[targetLang];
    if (entry?.t.trim() && entry.h === hashText(src.sourceText)) continue;
    items.push({
      id: `dict:${src.key}`,
      entityType: 'dict',
      entityId: 0,
      field: src.key,
      key: src.key,
      category: src.category,
      label: src.label,
      fieldLabel: src.fieldLabel,
      sourceLang: DEFAULT_SOURCE_LANG,
      sourceText: src.sourceText,
      targetLang,
      reason: entry?.t.trim() ? 'stale' : 'empty',
    });
  }

  return { items, totals };
}

const countBy = (items: BulkGapItem[]) => {
  const counts = emptyTotals();
  for (const i of items) counts[i.category]++;
  return counts;
};

/** Her aktif dil için tamamlanma özeti (sayfanın üstündeki dil kartları). */
router.get('/overview', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;
  const languages = await prisma.language.findMany({
    where: { isActive: true, NOT: { code: DEFAULT_SOURCE_LANG } },
    orderBy: { id: 'asc' },
  });
  const rows = [];
  for (const lang of languages) {
    const { items, totals } = await scan(restaurantId, lang.code);
    const total = Object.values(totals).reduce((a, b) => a + b, 0);
    rows.push({
      code: lang.code,
      name: lang.name,
      total,
      missing: items.length,
      percent: total ? Math.round(((total - items.length) / total) * 100) : 100,
      missingByCategory: countBy(items),
      totals,
    });
  }
  res.json({ languages: rows });
});

router.get('/gaps', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;

  const to = parseTargetLang(req.query.to);
  if (rejectSourceAsTarget(to, res)) return;
  if (!(await requireActiveTarget(to, res))) return;

  const { items, totals } = await scan(restaurantId, to);
  res.json({ targetLang: to, total: items.length, items, counts: countBy(items), totals });
});

router.post('/preview', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;

  const { to, ids } = req.body as { to?: string; ids?: string[] };
  const targetLang = parseTargetLang(to);
  if (rejectSourceAsTarget(targetLang, res)) return;
  if (!(await requireActiveTarget(targetLang, res))) return;

  const { items: allGaps } = await scan(restaurantId, targetLang);
  const idSet = ids?.length ? new Set(ids.map(String)) : null;
  const selected = idSet ? allGaps.filter((g) => idSet.has(g.id)) : allGaps;

  if (!selected.length) {
    return res.json({ targetLang, items: [], message: 'Çevrilecek boş alan yok' });
  }

  const openaiKey = await getOpenAiKey(restaurantId);
  const results: (BulkGapItem & { translatedText: string; error?: string })[] = [];

  for (let i = 0; i < selected.length; i++) {
    const gap = selected[i];
    // Kaynakla aynı metin (Latte vb.): API’ye gitmeden onaylanacak metni döndür
    if (gap.reason === 'same_as_source') {
      results.push({ ...gap, translatedText: gap.sourceText });
      continue;
    }
    try {
      const translatedText = await translateText(gap.sourceText, gap.sourceLang, targetLang, openaiKey);
      if (!translatedText) {
        results.push({ ...gap, translatedText: '', error: 'Çeviri boş geldi' });
      } else {
        results.push({ ...gap, translatedText });
      }
    } catch {
      results.push({ ...gap, translatedText: '', error: 'Çeviri alınamadı' });
    }
    if (!openaiKey && i < selected.length - 1) {
      await sleep(180);
    }
  }

  res.json({
    targetLang,
    items: results,
    okCount: results.filter((r) => r.translatedText && !r.error).length,
    failCount: results.filter((r) => r.error || !r.translatedText).length,
  });
});

router.post('/apply', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;

  const { to, items } = req.body as {
    to?: string;
    items?: {
      id: string;
      entityType: EntityType;
      entityId: number;
      field: string;
      key?: string;
      translatedText: string;
    }[];
  };

  const targetLang = parseTargetLang(to);
  if (rejectSourceAsTarget(targetLang, res)) return;
  if (!items?.length) {
    return res.status(400).json({ message: 'Kaydedilecek çeviri yok' });
  }
  if (!(await requireActiveTarget(targetLang, res))) return;

  let saved = 0;
  // Sözlük ve Sofra metinleri tek seferde yazılır
  let dict: Awaited<ReturnType<typeof loadDict>> | null = null;
  let dictSources: Map<string, string> | null = null;
  let sofra: ReturnType<typeof parseSofraConfig> | null = null;
  let sofraChanged = false;

  for (const item of items) {
    const text = String(item.translatedText || '').trim();
    if (!text) continue;

    if (item.entityType === 'group' && item.field === 'name') {
      const row = await prisma.group.findFirst({ where: { id: item.entityId, restaurantId } });
      if (!row) continue;
      await prisma.group.update({
        where: { id: row.id },
        data: { i18n: patchI18nFieldReviewed<GroupI18nEntry>(row.i18n, targetLang, 'name', text) },
      });
      saved += 1;
      continue;
    }

    if (item.entityType === 'product' && (PRODUCT_FIELDS as readonly string[]).includes(item.field)) {
      const row = await prisma.product.findFirst({ where: { id: item.entityId, restaurantId } });
      if (!row) continue;
      await prisma.product.update({
        where: { id: row.id },
        data: {
          i18n: patchI18nFieldReviewed<ProductI18nEntry>(row.i18n, targetLang, item.field as keyof ProductI18nEntry, text),
        },
      });
      saved += 1;
      continue;
    }

    if (item.entityType === 'showcase' && (item.field === 'title1' || item.field === 'title2')) {
      const row = await prisma.showcaseImage.findFirst({ where: { id: item.entityId, restaurantId } });
      if (!row) continue;
      await prisma.showcaseImage.update({
        where: { id: row.id },
        data: { i18n: patchI18nFieldReviewed<ShowcaseI18nEntry>(row.i18n, targetLang, item.field, text) },
      });
      saved += 1;
      continue;
    }

    if (item.entityType === 'sofra' && (SOFRA_TEXT_FIELDS as readonly string[]).includes(item.field)) {
      if (!sofra) {
        const row = await prisma.setting.findUnique({
          where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
        });
        sofra = parseSofraConfig(row?.value);
      }
      sofra = {
        ...sofra,
        texts: { ...sofra.texts, [targetLang]: { ...(sofra.texts[targetLang] || {}), [item.field]: text } },
      };
      sofraChanged = true;
      saved += 1;
      continue;
    }

    if (item.entityType === 'dict' && item.key) {
      if (!dict || !dictSources) {
        dict = await loadDict(restaurantId);
        dictSources = new Map((await collectDictSources(restaurantId)).map((s) => [s.key, s.sourceText]));
      }
      const source = dictSources.get(item.key);
      if (source === undefined) continue; // kaynak artık yok
      dict = dictSet(dict, item.key, targetLang, text, source);
      saved += 1;
    }
  }

  if (sofraChanged && sofra) {
    const value = JSON.stringify(normalizeSofraConfig(sofra));
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId, key: SOFRA_SETTINGS_KEY } },
      update: { value },
      create: { restaurantId, key: SOFRA_SETTINGS_KEY, value },
    });
  }
  if (dict) {
    const value = serializeDict(dict);
    await prisma.setting.upsert({
      where: { restaurantId_key: { restaurantId, key: I18N_DICT_KEY } },
      update: { value },
      create: { restaurantId, key: I18N_DICT_KEY, value },
    });
  }

  res.json({ ok: true, saved, message: `${saved} çeviri kaydedildi` });
});

/** Bir dilin bu restorandaki tüm çevirilerini siler (dil kalır; baştan çevirmek için). */
router.post('/reset', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;
  const targetLang = parseTargetLang((req.body as { to?: string } | undefined)?.to);
  if (rejectSourceAsTarget(targetLang, res)) return;
  const result = await purgeLanguage(targetLang, { restaurantId, keepAllergens: true });
  res.json({ ok: true, ...result });
});

export default router;

import { Router } from 'express';
import { authRequired, getRestaurantId } from '../lib/auth.js';
import { ownsAddon } from '../lib/addons.js';
import { prisma } from '../lib/prisma.js';
import {
  findSourceField,
  getGroupName,
  getProductField,
  getRawField,
  getShowcaseTitles,
  patchI18nField,
  type GroupI18nEntry,
  type ProductI18nEntry,
  type ShowcaseI18nEntry,
} from '../lib/i18n-json.js';
import { sleep, translateText } from '../lib/translate-service.js';

const router = Router();
router.use(authRequired);

type GapCategory = 'groups' | 'products' | 'showcase' | 'stories';
type GapField = 'name' | 'description' | 'ingredients' | 'allergens' | 'title1' | 'title2';
type EntityType = 'group' | 'product' | 'showcase';

export interface BulkGapItem {
  id: string;
  entityType: EntityType;
  entityId: number;
  field: GapField;
  category: GapCategory;
  label: string;
  fieldLabel: string;
  sourceLang: string;
  sourceText: string;
  targetLang: string;
  reason: 'empty' | 'same_as_source';
}

const FIELD_LABELS: Record<GapField, string> = {
  name: 'Ad',
  description: 'Açıklama',
  ingredients: 'İçindekiler',
  allergens: 'Alerjenler',
  title1: 'Başlık 1',
  title2: 'Başlık 2',
};

const PRODUCT_FIELDS: GapField[] = ['name', 'description', 'ingredients', 'allergens'];

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

/** Boş veya kaynak dille birebir aynı (çevrilmemiş kopya) → eksik say */
function needsTranslation(
  json: unknown,
  targetLang: string,
  field: string,
  preferred: string[]
): { sourceLang: string; sourceText: string; reason: 'empty' | 'same_as_source' } | null {
  const source = findSourceField<Record<string, unknown>>(
    json,
    targetLang,
    field,
    preferred
  );
  if (!source) return null;

  const raw = getRawField<Record<string, unknown>>(json, targetLang, field);
  if (!raw) {
    return { sourceLang: source.lang, sourceText: source.text, reason: 'empty' };
  }

  // Başka dildeki kaynakla birebir aynıysa muhtemelen çevrilmemiş kopya
  if (raw === source.text && source.lang !== targetLang) {
    return { sourceLang: source.lang, sourceText: source.text, reason: 'same_as_source' };
  }

  return null;
}

async function collectGaps(restaurantId: number, targetLang: string): Promise<BulkGapItem[]> {
  const languages = await prisma.language.findMany({
    where: { isActive: true },
    orderBy: { id: 'asc' },
  });
  const preferred = [
    'tr',
    ...languages.map((l) => l.code).filter((c) => c !== 'tr' && c !== targetLang),
  ];

  const gaps: BulkGapItem[] = [];

  const groups = await prisma.group.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  for (const group of groups) {
    const need = needsTranslation(group.i18n, targetLang, 'name', preferred);
    if (!need) continue;
    gaps.push({
      id: `group:${group.id}:name`,
      entityType: 'group',
      entityId: group.id,
      field: 'name',
      category: 'groups',
      label: getGroupName(group.i18n, need.sourceLang) || `Grup #${group.id}`,
      fieldLabel: FIELD_LABELS.name,
      sourceLang: need.sourceLang,
      sourceText: need.sourceText,
      targetLang,
      reason: need.reason,
    });
  }

  const products = await prisma.product.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  for (const product of products) {
    const display =
      getProductField(product.i18n, 'tr', 'name') ||
      getProductField(product.i18n, preferred[0] || 'tr', 'name') ||
      `Ürün #${product.id}`;

    for (const field of PRODUCT_FIELDS) {
      const need = needsTranslation(product.i18n, targetLang, field, preferred);
      if (!need) continue;
      gaps.push({
        id: `product:${product.id}:${field}`,
        entityType: 'product',
        entityId: product.id,
        field,
        category: 'products',
        label: display,
        fieldLabel: FIELD_LABELS[field],
        sourceLang: need.sourceLang,
        sourceText: need.sourceText,
        targetLang,
        reason: need.reason,
      });
    }
  }

  const showcases = await prisma.showcaseImage.findMany({
    where: { restaurantId },
    orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
  });

  for (const item of showcases) {
    const isStory = item.displayType === 'story';
    const category: GapCategory = isStory ? 'stories' : 'showcase';
    const titles = getShowcaseTitles(item.i18n, preferred.find((c) => c !== targetLang) || 'tr');
    const display = titles.title1 || titles.title2 || item.name || `Vitrin #${item.id}`;

    for (const field of ['title1', 'title2'] as const) {
      const need = needsTranslation(item.i18n, targetLang, field, preferred);
      if (!need) continue;
      gaps.push({
        id: `showcase:${item.id}:${field}`,
        entityType: 'showcase',
        entityId: item.id,
        field,
        category,
        label: display,
        fieldLabel: FIELD_LABELS[field],
        sourceLang: need.sourceLang,
        sourceText: need.sourceText,
        targetLang,
        reason: need.reason,
      });
    }
  }

  return gaps;
}

router.get('/gaps', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;

  const to = String(req.query.to || '').toLowerCase().split('-')[0];
  if (!to) {
    return res.status(400).json({ message: 'Hedef dil gerekli' });
  }

  const active = await prisma.language.findFirst({
    where: { code: to, isActive: true },
  });
  if (!active) {
    return res.status(400).json({ message: 'Hedef dil aktif değil' });
  }

  const items = await collectGaps(restaurantId, to);
  res.json({
    targetLang: to,
    total: items.length,
    items,
    counts: {
      groups: items.filter((i) => i.category === 'groups').length,
      products: items.filter((i) => i.category === 'products').length,
      showcase: items.filter((i) => i.category === 'showcase').length,
      stories: items.filter((i) => i.category === 'stories').length,
    },
  });
});

router.post('/preview', async (req, res) => {
  const restaurantId = await requireLangPack(req, res);
  if (!restaurantId) return;

  const { to, ids } = req.body as { to?: string; ids?: string[] };
  const targetLang = String(to || '')
    .toLowerCase()
    .split('-')[0];
  if (!targetLang) {
    return res.status(400).json({ message: 'Hedef dil gerekli' });
  }

  const active = await prisma.language.findFirst({
    where: { code: targetLang, isActive: true },
  });
  if (!active) {
    return res.status(400).json({ message: 'Hedef dil aktif değil' });
  }

  const allGaps = await collectGaps(restaurantId, targetLang);
  const idSet = ids?.length ? new Set(ids.map(String)) : null;
  const selected = idSet ? allGaps.filter((g) => idSet.has(g.id)) : allGaps;

  if (!selected.length) {
    return res.json({ targetLang, items: [], message: 'Çevrilecek boş alan yok' });
  }

  const openaiKey = await getOpenAiKey(restaurantId);
  const results: (BulkGapItem & { translatedText: string; error?: string })[] = [];

  for (let i = 0; i < selected.length; i++) {
    const gap = selected[i];
    try {
      const translatedText = await translateText(
        gap.sourceText,
        gap.sourceLang,
        targetLang,
        openaiKey
      );
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
      field: GapField;
      translatedText: string;
    }[];
  };

  const targetLang = String(to || '')
    .toLowerCase()
    .split('-')[0];
  if (!targetLang || !items?.length) {
    return res.status(400).json({ message: 'Kaydedilecek çeviri yok' });
  }

  const active = await prisma.language.findFirst({
    where: { code: targetLang, isActive: true },
  });
  if (!active) {
    return res.status(400).json({ message: 'Hedef dil aktif değil' });
  }

  let saved = 0;

  for (const item of items) {
    const text = String(item.translatedText || '').trim();
    if (!text) continue;

    if (item.entityType === 'group' && item.field === 'name') {
      const row = await prisma.group.findFirst({
        where: { id: item.entityId, restaurantId },
      });
      if (!row) continue;
      await prisma.group.update({
        where: { id: row.id },
        data: {
          i18n: patchI18nField<GroupI18nEntry>(row.i18n, targetLang, 'name', text),
        },
      });
      saved += 1;
      continue;
    }

    if (
      item.entityType === 'product' &&
      PRODUCT_FIELDS.includes(item.field)
    ) {
      const row = await prisma.product.findFirst({
        where: { id: item.entityId, restaurantId },
      });
      if (!row) continue;
      await prisma.product.update({
        where: { id: row.id },
        data: {
          i18n: patchI18nField<ProductI18nEntry>(
            row.i18n,
            targetLang,
            item.field as keyof ProductI18nEntry,
            text
          ),
        },
      });
      saved += 1;
      continue;
    }

    if (
      item.entityType === 'showcase' &&
      (item.field === 'title1' || item.field === 'title2')
    ) {
      const row = await prisma.showcaseImage.findFirst({
        where: { id: item.entityId, restaurantId },
      });
      if (!row) continue;
      await prisma.showcaseImage.update({
        where: { id: row.id },
        data: {
          i18n: patchI18nField<ShowcaseI18nEntry>(row.i18n, targetLang, item.field, text),
        },
      });
      saved += 1;
    }
  }

  res.json({ ok: true, saved, message: `${saved} çeviri kaydedildi` });
});

export default router;

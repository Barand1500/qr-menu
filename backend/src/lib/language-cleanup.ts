import { prisma } from './prisma.js';
import { I18N_DICT_KEY, dictStripLang, parseDict, serializeDict, stripLangFromMap } from './i18n-dict.js';
import { SOFRA_SETTINGS_KEY } from './sofra-config.js';

export type PurgeResult = { groups: number; products: number; showcase: number; settings: number };

type Json = import('@prisma/client').Prisma.InputJsonValue;

/**
 * Bir dile ait bütün çevirileri siler: gruplar, ürünler, vitrin/hikâyeler, karşılama mesajı,
 * Sofra tema metinleri ve çeviri sözlüğü. `restaurantId` verilirse yalnızca o restoran temizlenir;
 * verilmezse (dil tamamen silinirken) tüm restoranlar temizlenir.
 * `keepAllergens`: ürünlerde alerjen metni etiketlerden otomatik üretilir; temizlikte korunur.
 */
export async function purgeLanguage(
  code: string,
  opts: { restaurantId?: number; keepAllergens?: boolean } = {},
): Promise<PurgeResult> {
  const lang = code.toLowerCase().split('-')[0];
  if (!lang || lang === 'tr') return { groups: 0, products: 0, showcase: 0, settings: 0 };
  const where = opts.restaurantId ? { restaurantId: opts.restaurantId } : {};
  const result: PurgeResult = { groups: 0, products: 0, showcase: 0, settings: 0 };

  for (const row of await prisma.group.findMany({ where, select: { id: true, i18n: true } })) {
    const next = stripLangFromMap(row.i18n, lang);
    if (next) {
      await prisma.group.update({ where: { id: row.id }, data: { i18n: next as Json } });
      result.groups++;
    }
  }
  for (const row of await prisma.product.findMany({ where, select: { id: true, i18n: true } })) {
    const next = stripLangFromMap(row.i18n, lang, opts.keepAllergens ? ['allergens'] : []);
    if (next) {
      await prisma.product.update({ where: { id: row.id }, data: { i18n: next as Json } });
      result.products++;
    }
  }
  for (const row of await prisma.showcaseImage.findMany({ where, select: { id: true, i18n: true } })) {
    const next = stripLangFromMap(row.i18n, lang);
    if (next) {
      await prisma.showcaseImage.update({ where: { id: row.id }, data: { i18n: next as Json } });
      result.showcase++;
    }
  }
  for (const row of await prisma.restaurant.findMany({
    where: opts.restaurantId ? { id: opts.restaurantId } : {},
    select: { id: true, welcomeI18n: true },
  })) {
    const next = stripLangFromMap(row.welcomeI18n, lang);
    if (next) {
      await prisma.restaurant.update({ where: { id: row.id }, data: { welcomeI18n: next as Json } });
      result.settings++;
    }
  }

  // Ayar kayıtları: Sofra tema metinleri (texts[lang]) ve çeviri sözlüğü
  const settings = await prisma.setting.findMany({
    where: { key: { in: [SOFRA_SETTINGS_KEY, I18N_DICT_KEY] }, ...where },
    select: { id: true, key: true, value: true },
  });
  for (const row of settings) {
    let next: string | null = null;
    if (row.key === I18N_DICT_KEY) {
      const dict = parseDict(row.value);
      const stripped = dictStripLang(dict, lang);
      if (stripped !== dict) next = serializeDict(stripped);
    } else {
      try {
        const cfg = JSON.parse(row.value ?? "{}") as { texts?: Record<string, unknown> };
        if (cfg.texts && typeof cfg.texts === 'object' && lang in cfg.texts) {
          const { [lang]: _gone, ...rest } = cfg.texts;
          next = JSON.stringify({ ...cfg, texts: rest });
        }
      } catch {
        /* bozuk kayıt: dokunma */
      }
    }
    if (next !== null) {
      await prisma.setting.update({ where: { id: row.id }, data: { value: next } });
      result.settings++;
    }
  }
  return result;
}

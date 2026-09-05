/**
 * Mevcut ürünlere allergenTags + diyet bayrakları yazar.
 * Çalıştır: npx tsx prisma/backfill-allergen-tags.ts
 */
import { PrismaClient } from '@prisma/client';
import {
  allergensTextFromTags,
  inferAllergenTagsFromText,
  normalizePrefText,
  sanitizeAllergenTags,
} from '../src/lib/diet-allergens.js';

const prisma = new PrismaClient();

type I18nMap = Record<
  string,
  { name?: string; description?: string; ingredients?: string; allergens?: string }
>;

function collectText(i18n: unknown, features: unknown): string {
  const map = (i18n && typeof i18n === 'object' ? i18n : {}) as I18nMap;
  const parts: string[] = [];
  for (const entry of Object.values(map)) {
    if (!entry) continue;
    parts.push(entry.name || '', entry.description || '', entry.ingredients || '', entry.allergens || '');
  }
  if (Array.isArray(features)) {
    parts.push(...features.filter((f): f is string => typeof f === 'string'));
  }
  return parts.join(' ');
}

function handTune(name: string, tags: string[]): {
  allergenTags: string[];
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isDiabetic: boolean;
} {
  const n = normalizePrefText(name);
  let allergenTags = [...tags];
  let isVegan = false;
  let isVegetarian = false;
  let isGlutenFree = false;
  let isDiabetic = false;

  const ensure = (...ids: string[]) => {
    for (const id of ids) {
      if (!allergenTags.includes(id)) allergenTags.push(id);
    }
  };

  // Seed / bilinen ürünler
  if (n.includes('serpme kahvalti') || n.includes('turkish breakfast')) {
    ensure('dairy', 'gluten', 'egg');
    isVegetarian = true;
  } else if (n.includes('menemen')) {
    ensure('egg');
    isVegetarian = true;
    isGlutenFree = true;
  } else if (n.includes('avokado tost') || n.includes('avocado toast')) {
    ensure('gluten', 'egg');
    isVegetarian = true;
  } else if (n.includes('vegan burger')) {
    ensure('gluten');
    isVegan = true;
    isVegetarian = true;
  } else if (n.includes('zeen burger') || n.includes('tavuk burger') || n.includes('chicken burger')) {
    ensure('gluten', 'dairy', 'egg');
  } else if (n.includes('margherita')) {
    ensure('gluten', 'dairy');
    isVegetarian = true;
  } else if (n.includes('karisik pizza') || n.includes('mixed pizza')) {
    ensure('gluten', 'dairy');
  } else if (n.includes('caesar')) {
    ensure('gluten', 'dairy', 'egg', 'fish'); // klasik Caesar: ançuez + kruton + parmesan
    isVegetarian = false;
  } else if (n.includes('akdeniz salata') || n.includes('mediterranean salad')) {
    ensure('dairy');
    isVegetarian = true;
    isGlutenFree = true;
  } else if (n.includes('tiramisu')) {
    ensure('dairy', 'egg', 'gluten');
    isVegetarian = true;
  } else if (n.includes('sufle') || n.includes('souffle')) {
    ensure('dairy', 'egg', 'gluten');
    isVegetarian = true;
  } else if (n.includes('latte')) {
    ensure('dairy');
    isVegetarian = true;
    isGlutenFree = true;
  } else if (n.includes('portakal') || n.includes('orange juice')) {
    isVegan = true;
    isVegetarian = true;
    isGlutenFree = true;
    isDiabetic = false;
  } else {
    // Genel çıkarım sonrası diyet tahmini
    const meat = /dana|tavuk|et |sucuk|kofte|beef|chicken|sausage|burger|pizza|anchov|ancuez/.test(n);
    const veganHint = /vegan/.test(n);
    if (veganHint) {
      isVegan = true;
      isVegetarian = true;
    } else if (!meat && (allergenTags.includes('dairy') || allergenTags.includes('egg') || /salata|tost|kahvalti|tatli|latte|smoothie/.test(n))) {
      isVegetarian = true;
    }
    if (!allergenTags.includes('gluten') && /salata|smoothie|portakal|cay |coffee|espresso/.test(n)) {
      isGlutenFree = true;
    }
  }

  if (isVegan) isVegetarian = true;
  allergenTags = sanitizeAllergenTags(allergenTags);

  return { allergenTags, isVegan, isVegetarian, isGlutenFree, isDiabetic };
}

function patchI18nAllergens(i18n: unknown, tags: string[]): I18nMap {
  const map = { ...((i18n && typeof i18n === 'object' ? i18n : {}) as I18nMap) };
  for (const code of ['tr', 'en', 'ru', 'ar', ...Object.keys(map)]) {
    map[code] = {
      ...map[code],
      allergens: allergensTextFromTags(tags, code),
    };
  }
  return map;
}

async function main() {
  const products = await prisma.product.findMany();
  console.log(`${products.length} ürün işlenecek…`);

  for (const p of products) {
    const text = collectText(p.i18n, p.features);
    const inferred = inferAllergenTagsFromText(text);
    const name =
      (p.i18n as I18nMap)?.tr?.name ||
      Object.values((p.i18n as I18nMap) || {})[0]?.name ||
      '';
    const tuned = handTune(name, inferred);

    await prisma.product.update({
      where: { id: p.id },
      data: {
        allergenTags: tuned.allergenTags,
        isVegan: tuned.isVegan,
        isVegetarian: tuned.isVegetarian,
        isGlutenFree: tuned.isGlutenFree,
        isDiabetic: tuned.isDiabetic,
        i18n: patchI18nAllergens(p.i18n, tuned.allergenTags),
      },
    });

    console.log(
      `#${p.id} ${name || '?'} → [${tuned.allergenTags.join(', ') || '—'}]` +
        ` vegan=${tuned.isVegan} vejetaryen=${tuned.isVegetarian}` +
        ` GF=${tuned.isGlutenFree}`
    );
  }

  console.log('Tamam.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

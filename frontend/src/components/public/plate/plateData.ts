import { allergenLabel, dietLabel, loadDietaryPrefs } from '@/lib/dietAllergens';

/** Ürün sayfasının "tabak görünümü" için küçük yardımcılar. */

const ALLERGEN_WORDS: Record<string, string[]> = {
  gluten: ['gluten', 'buğday', 'bugday', 'wheat', 'arpa', 'çavdar', 'makarna', 'hamur', 'ekmek'],
  dairy: ['süt', 'sut', 'laktoz', 'lactose', 'dairy', 'milk', 'krema', 'cream', 'peynir', 'cheese', 'tereyağ', 'yoğurt', 'yogurt', 'kaymak', 'parmesan', 'mozzarella'],
  egg: ['yumurta', 'egg'],
  peanut: ['yer fıstığı', 'fıstık', 'peanut'],
  'tree-nut': ['fındık', 'ceviz', 'badem', 'kaju', 'antep fıstığı', 'kuruyemiş', 'nut', 'hazelnut', 'walnut', 'almond'],
  soy: ['soya', 'soy'],
  fish: ['balık', 'balik', 'fish', 'somon', 'levrek', 'hamsi', 'ton balığı'],
  shellfish: ['karides', 'midye', 'kalamar', 'yengeç', 'ıstakoz', 'kabuklu', 'shellfish', 'shrimp'],
  sesame: ['susam', 'sesame', 'tahin'],
  mustard: ['hardal', 'mustard'],
};
const ANIMAL_WORDS = ['et', 'dana', 'kuzu', 'tavuk', 'piliç', 'hindi', 'balık', 'sucuk', 'salam', 'sosis', 'jambon', 'pastırma', 'kıyma', 'biftek', 'karides', 'meat', 'chicken', 'beef', 'fish'];
const DAIRY_EGG_HONEY = ['süt', 'krema', 'peynir', 'tereyağ', 'yoğurt', 'yumurta', 'bal', 'milk', 'cheese', 'butter', 'egg', 'honey'];

const lc = (s: string) => s.toLocaleLowerCase('tr');
const hasWord = (text: string, word: string) => {
  const t = ` ${lc(text).replace(/[^a-zçğıöşü0-9 ]/gi, ' ')} `;
  return t.includes(` ${word} `) || (word.length > 3 && lc(text).includes(word));
};

export type DietReport = {
  status: 'none' | 'ok' | 'warn';
  /** Müşterinin işaretlediği ve içerikte geçen şeyler ("Gluten", "Süt / Laktoz"...) */
  conflicts: string[];
  /** Çakışan kelimeler: malzeme halkasında kırmızı yanması için */
  words: string[];
};

/**
 * Müşterinin menüde işaretlediği alerji/diyet tercihlerini ürün metniyle karşılaştırır.
 * Yalnızca içerik/alerjen yazısına dayanır; "güvenli" demez, yazıda çakışma bulunamadı der.
 */
export function analyzeDiet(texts: (string | undefined | null)[], lang: string): DietReport {
  const body = texts.filter(Boolean).join(' , ');
  if (!body.trim()) return { status: 'none', conflicts: [], words: [] };
  let prefs;
  try {
    prefs = loadDietaryPrefs();
  } catch {
    return { status: 'none', conflicts: [], words: [] };
  }
  if (!prefs.allergens.length && !prefs.diets.length) return { status: 'none', conflicts: [], words: [] };

  const conflicts: string[] = [];
  const words: string[] = [];
  for (const id of prefs.allergens) {
    const list = ALLERGEN_WORDS[id];
    if (!list) continue;
    const hit = list.filter((w) => hasWord(body, w));
    if (hit.length) {
      conflicts.push(allergenLabel(id, lang));
      words.push(...hit);
    }
  }
  for (const id of prefs.diets) {
    if (id === 'gluten-free') {
      const hit = ALLERGEN_WORDS.gluten.filter((w) => hasWord(body, w));
      if (hit.length) {
        conflicts.push(dietLabel(id, lang));
        words.push(...hit);
      }
    } else if (id === 'vegetarian' || id === 'vegan') {
      const list = id === 'vegan' ? [...ANIMAL_WORDS, ...DAIRY_EGG_HONEY] : ANIMAL_WORDS;
      const hit = list.filter((w) => hasWord(body, w));
      if (hit.length) {
        conflicts.push(dietLabel(id, lang));
        words.push(...hit);
      }
    }
  }
  const uniq = (a: string[]) => [...new Set(a)];
  return conflicts.length ? { status: 'warn', conflicts: uniq(conflicts), words: uniq(words) } : { status: 'ok', conflicts: [], words: [] };
}

/** Malzeme adı çakışan kelimelerden birini içeriyorsa true */
export const isFlagged = (name: string, words: string[]) => words.some((w) => hasWord(name, w));

/** Seçeneğin adından porsiyon büyüklüğü: tabak büyür/küçülür */
export function sizeScale(label: string): number {
  const l = lc(label);
  if (/\b(büyük|buyuk|large|xl|jumbo|maxi|double|çift|ikili|aile|family)\b/.test(l)) return 1.07;
  if (/\b(küçük|kucuk|small|mini|single|tek|yarım)\b/.test(l)) return 0.94;
  return 1;
}

/** Fotoğrafın baskın rengi (sahne ışığı için). Çapraz kaynak engellenirse null döner. */
export async function dominantColor(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = c.height = 28;
        const ctx = c.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0, 28, 28);
        const d = ctx.getImageData(4, 4, 20, 20).data;
        let r = 0;
        let g = 0;
        let b = 0;
        let w = 0;
        for (let i = 0; i < d.length; i += 4) {
          const max = Math.max(d[i], d[i + 1], d[i + 2]);
          const min = Math.min(d[i], d[i + 1], d[i + 2]);
          const sat = max === 0 ? 0 : (max - min) / max;
          const weight = 0.15 + sat * sat * 2.2 + (max > 40 && max < 235 ? 0.4 : 0);
          r += d[i] * weight;
          g += d[i + 1] * weight;
          b += d[i + 2] * weight;
          w += weight;
        }
        if (!w) return resolve(null);
        // Canlandır: doygunluğu biraz artır
        const avg = [r / w, g / w, b / w];
        const m = (avg[0] + avg[1] + avg[2]) / 3;
        const boost = (v: number) => Math.round(Math.max(0, Math.min(255, m + (v - m) * 1.45)));
        resolve(`rgb(${boost(avg[0])}, ${boost(avg[1])}, ${boost(avg[2])})`);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

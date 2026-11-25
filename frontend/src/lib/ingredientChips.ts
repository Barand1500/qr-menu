/**
 * Ürün "İçindekiler" / "Alerjenler" metnini küçük etiketlere böler.
 * Serbest yazı olduğu için temkinli çalışır: liste gibi görünmüyorsa null döner ve metin olduğu gibi gösterilir.
 */
export type IngredientParse = { main: string[]; extra: string[] };

const OPTIONAL = /(eklenebilir|ilave\s+edilebilir|isteğe\s+bağlı|tercihe\s+göre|opsiyonel|servis\s+edilebilir|may\s+be\s+added|can\s+be\s+added|optional)/i;
const LEAD = /^(tariflere\s+göre|tarife\s+göre|isteğe\s+göre|tercihe\s+göre|ayrıca|ek\s+olarak|bunun\s+yanında|depending\s+on\s+the\s+recipe|optionally)[,:]?\s+/i;
const TAIL = /\s+((temel|ana)\s+)?(bileşen|malzeme|içerik)\w*\s*$|\s+(eklenebilir|eklenir|ilave\s+edilebilir|kullanılır|kullanılabilir|servis\s+edilebilir|içerir|içermektedir|bulunur|may\s+be\s+added|can\s+be\s+added)\s*$/i;
const SPLIT = /\s*[,;•·]\s*|\s+(?:ve|veya|ya\s+da|ile|and|or)\s+/i;

const cap = (s: string) => (s ? s.charAt(0).toLocaleUpperCase('tr') + s.slice(1) : s);

export function parseIngredients(raw: string, allowOptional = true): IngredientParse | null {
  const text = String(raw || '')
    .replace(/\r?\n+/g, '. ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  const sentences = text.split(/(?<=[.!?])\s+/).map((s) => s.replace(/[.!?]+$/, '').trim()).filter(Boolean);

  const main: string[] = [];
  const extra: string[] = [];
  for (const sentence of sentences) {
    const optional = allowOptional && OPTIONAL.test(sentence);
    let s = sentence;
    for (let i = 0; i < 3 && LEAD.test(s); i++) s = s.replace(LEAD, '');
    for (let i = 0; i < 3 && TAIL.test(s); i++) s = s.replace(TAIL, '');
    const items = s
      .split(SPLIT)
      .map((x) => x.replace(/^(ve|veya|ya da|and|or)\s+/i, '').trim())
      .filter(Boolean);
    if (!items.length) continue;
    // Bir madde 6 kelimeden uzunsa bu cümle liste değil, düz yazıdır
    if (items.some((x) => x.split(/\s+/).length > 6 || x.length > 48)) return null;
    (optional ? extra : main).push(...items.map(cap));
  }

  const seen = new Set<string>();
  const uniq = (list: string[]) =>
    list.filter((x) => {
      const key = x.toLocaleLowerCase('tr');
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  const m = uniq(main);
  const e = uniq(extra);
  if (m.length + e.length < 2 || m.length + e.length > 40) return null;
  return { main: m, extra: e };
}

// Tanıdık malzemelere küçük simge; bulunamazsa nokta gösterilir
const EMOJI: [RegExp, string][] = [
  [/krema|süt|laktoz/i, '🥛'],
  [/sarımsak/i, '🧄'],
  [/\btuz\b/i, '🧂'],
  [/karabiber|pul\s*biber|acı/i, '🌶️'],
  [/biber/i, '🫑'],
  [/domates/i, '🍅'],
  [/soğan/i, '🧅'],
  [/havuç/i, '🥕'],
  [/maydanoz|dereotu|nane|fesleğen|roka|kekik|biberiye|reyhan/i, '🌿'],
  [/mantar/i, '🍄'],
  [/peynir|parmesan|kaşar|mozzarella|lor|labne|cheddar/i, '🧀'],
  [/tavuk|piliç|hindi/i, '🍗'],
  [/\bet\b|dana|kuzu|kıyma|biftek|bonfile|pastırma/i, '🥩'],
  [/balık|somon|levrek|ton\b|hamsi/i, '🐟'],
  [/karides|midye|kalamar/i, '🦐'],
  [/yumurta/i, '🥚'],
  [/makarna|penne|spagetti|noodle/i, '🍝'],
  [/pilav|pirinç|bulgur/i, '🍚'],
  [/ekmek|hamur|un\b|tortilla|lavaş/i, '🍞'],
  [/zeytin/i, '🫒'],
  [/limon/i, '🍋'],
  [/patates/i, '🥔'],
  [/mısır/i, '🌽'],
  [/avokado/i, '🥑'],
  [/patlıcan/i, '🍆'],
  [/salatalık|turşu/i, '🥒'],
  [/marul|lahana|ıspanak|semizotu/i, '🥬'],
  [/tereyağ|yağ\b/i, '🧈'],
  [/\bbal\b|pekmez/i, '🍯'],
  [/çikolata|kakao/i, '🍫'],
  [/çilek|frambuaz|ahududu|böğürtlen/i, '🍓'],
  [/elma/i, '🍎'],
  [/muz/i, '🍌'],
  [/fındık|ceviz|fıstık|badem|kuruyemiş/i, '🥜'],
  [/susam/i, '🌱'],
  [/sosis|sucuk|salam/i, '🌭'],
  [/\bsos\b|sosu|ketçap|mayonez|hardal/i, '🥫'],
  [/baharat|köri|zerdeçal|kimyon|tarçın|vanilya/i, '✨'],
  [/gluten|buğday/i, '🌾'],
];
export function ingredientEmoji(name: string): string {
  for (const [re, e] of EMOJI) if (re.test(name)) return e;
  return '';
}

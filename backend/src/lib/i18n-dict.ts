// Çeviri sözlüğü: hakkında sayfası, iletişim kartı, elle yorumlar, ürün seçenekleri ve kampanya adları gibi
// kendi i18n alanı olmayan metinler için tek bir ayar kaydı. Anahtar = metnin kimliği, değer = dil → çeviri.
// Her çeviri, çevrildiği kaynak metnin özetini taşır: kaynak değişirse çeviri bayat sayılır ve gösterilmez.

export const I18N_DICT_KEY = 'i18n_dict_v1';

export type DictEntry = { t: string; h: string };
export type Dict = Record<string, Record<string, DictEntry>>;

/** Kısa, kararlı özet (FNV-1a 32 bit). Güvenlik amaçlı değil, değişiklik algılamak için. */
export function hashText(value: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(36);
}

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);

export function parseDict(raw?: string | null): Dict {
  if (!raw) return {};
  try {
    const json = JSON.parse(raw) as unknown;
    if (!isObject(json)) return {};
    const out: Dict = {};
    for (const [key, langs] of Object.entries(json)) {
      if (!isObject(langs)) continue;
      const row: Record<string, DictEntry> = {};
      for (const [lang, entry] of Object.entries(langs)) {
        if (!isObject(entry) || typeof entry.t !== 'string' || typeof entry.h !== 'string') continue;
        if (!/^[a-z]{2,10}$/.test(lang)) continue;
        row[lang] = { t: entry.t.slice(0, 4000), h: entry.h.slice(0, 20) };
      }
      if (Object.keys(row).length) out[key.slice(0, 160)] = row;
    }
    return out;
  } catch {
    return {};
  }
}

export function serializeDict(dict: Dict): string {
  return JSON.stringify(dict);
}

/** Çeviri varsa ve kaynak hâlâ aynıysa çeviriyi, değilse boş döndürür. */
export function dictGet(dict: Dict, key: string, lang: string, sourceText: string): string {
  const entry = dict[key]?.[lang];
  if (!entry || !entry.t.trim()) return '';
  return entry.h === hashText(sourceText) ? entry.t : '';
}

/** Gösterim için: çeviri yoksa kaynak metin. */
export function dictText(dict: Dict, key: string, lang: string, sourceText: string): string {
  if (!sourceText || lang === 'tr') return sourceText;
  return dictGet(dict, key, lang, sourceText) || sourceText;
}

export function dictSet(dict: Dict, key: string, lang: string, text: string, sourceText: string): Dict {
  return { ...dict, [key]: { ...(dict[key] || {}), [lang]: { t: text.trim().slice(0, 4000), h: hashText(sourceText) } } };
}

/** Bir dile ait tüm çevirileri siler. Değişen bir şey yoksa aynı nesneyi döndürür. */
export function dictStripLang(dict: Dict, lang: string): Dict {
  let changed = false;
  const out: Dict = {};
  for (const [key, langs] of Object.entries(dict)) {
    if (!(lang in langs)) {
      out[key] = langs;
      continue;
    }
    changed = true;
    const { [lang]: _gone, ...rest } = langs;
    if (Object.keys(rest).length) out[key] = rest;
  }
  return changed ? out : dict;
}

/**
 * Dil → alan haritası (ör. group.i18n: { tr: {name}, en: {name} }) içinden bir dili çıkarır.
 * `keepFields` verilirse o alanlar korunur (ör. alerjen metni otomatik üretilir).
 * Değişiklik yoksa null döner (veritabanına yazmaya gerek yok).
 */
export function stripLangFromMap(json: unknown, lang: string, keepFields: string[] = []): Record<string, unknown> | null {
  if (!isObject(json) || !(lang in json)) return null;
  const { [lang]: entry, ...rest } = json;
  const kept: Record<string, unknown> = {};
  if (isObject(entry)) {
    for (const f of keepFields) if (typeof entry[f] === 'string' && (entry[f] as string).trim()) kept[f] = entry[f];
  }
  return Object.keys(kept).length ? { ...rest, [lang]: kept } : rest;
}

/** Elle girilen yorumun sözlük anahtarı: içerik değişirse anahtar da değişir (bayat çeviri gösterilmez). */
export const reviewKey = (name: string, text: string) => `review:${hashText(`${name}|${text}`)}`;

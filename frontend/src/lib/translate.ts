import { api } from '@/lib/api';

export async function autoTranslate(
  text: string,
  from: string,
  to: string
): Promise<string> {
  const result = await api<{ text: string }>('/api/admin/translate', {
    method: 'POST',
    body: JSON.stringify({ text, from, to }),
  });
  return result.text;
}

/** TR metni aktif dillere çevirir; çeviri başarısız olursa TR kalır */
export async function translatePrefLabel(
  textTr: string,
  languageCodes: string[]
): Promise<Record<string, string>> {
  const name = textTr.trim();
  const label: Record<string, string> = { tr: name };
  const targets = [...new Set(languageCodes.map((c) => c.split('-')[0].toLowerCase()))].filter(
    (c) => c && c !== 'tr'
  );

  await Promise.all(
    targets.map(async (code) => {
      try {
        label[code] = await autoTranslate(name, 'tr', code);
      } catch {
        label[code] = name;
      }
    })
  );

  for (const code of ['en', 'ru', 'ar']) {
    if (!label[code]) label[code] = name;
  }
  return label;
}

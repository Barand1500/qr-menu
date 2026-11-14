/** Small spelling mistakes in menu names; no dictionary, external service or generated products. */
export function normalizeMenuText(text: string): string {
  return text
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function distance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) rows[i][0] = i;
  for (let j = 0; j <= b.length; j++) rows[0][j] = j;
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) {
      rows[i][j] = Math.min(
        rows[i - 1][j] + 1,
        rows[i][j - 1] + 1,
        rows[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        rows[i][j] = Math.min(rows[i][j], rows[i - 2][j - 2] + 1);
    }
  return rows[a.length][b.length];
}

export function searchMenu<T>(
  items: T[],
  query: string,
  fields: (item: T) => string[],
): { item: T; suggestion?: string }[] {
  const q = normalizeMenuText(query).slice(0, 80);
  if (!q) return [];
  const terms = q.split(' ').slice(0, 8);
  const indexed = items.map((item) => ({ item, fields: fields(item) }));
  const exact = indexed.filter((row) =>
    terms.every((term) => row.fields.some((field) => normalizeMenuText(field).includes(term))),
  );
  if (exact.length) return exact.map(({ item }) => ({ item }));
  const matches: { item: T; score: number; suggestion: string }[] = [];
  for (const row of indexed) {
    const words = row.fields
      .flatMap((field) => field.split(/[^\p{L}\p{N}]+/u).filter(Boolean))
      .map((original) => ({ original, word: normalizeMenuText(original) }));
    let score = 0;
    const corrected: string[] = [];
    let matched = true;
    for (const term of terms) {
      let best: { score: number; word: string } | undefined;
      for (const { word, original } of words) {
        if (word.includes(term)) {
          best = { score: 0, word: term };
          break;
        }
        if (term.length < 3 || term.length > 40) continue;
        const limit = term.length >= 6 ? 2 : 1;
        const candidates = [
          word,
          ...[term.length - 1, term.length, term.length + 1]
            .filter((n) => n >= 3 && n < word.length)
            .map((n) => word.slice(0, n)),
        ];
        for (const candidate of candidates) {
          if (Math.abs(candidate.length - term.length) > limit) continue;
          const d = distance(term, candidate);
          if (d <= limit && (!best || d < best.score)) best = { score: d, word: original };
        }
      }
      if (!best) {
        matched = false;
        break;
      }
      score += best.score;
      corrected.push(best.word);
    }
    if (matched) matches.push({ item: row.item, score, suggestion: corrected.join(' ') });
  }
  matches.sort((a, b) => a.score - b.score);
  return matches.map(({ item, suggestion }) => ({ item, suggestion }));
}

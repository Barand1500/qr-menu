/**
 * Language a guest starts with: their earlier choice if it is still offered, otherwise the
 * first browser language the restaurant supports, otherwise the fallback.
 */
export function pickMenuLang(languages: { code: string }[], fallback = 'tr'): string {
  const codes = languages.map((l) => l.code);
  try {
    const stored = localStorage.getItem('menu_lang');
    if (stored && codes.includes(stored)) return stored;
  } catch {}
  const wanted =
    typeof navigator === 'undefined'
      ? []
      : navigator.languages?.length
        ? navigator.languages
        : [navigator.language];
  for (const raw of wanted) {
    const pref = (raw || '').toLowerCase();
    if (!pref) continue;
    const match =
      codes.find((code) => code.toLowerCase() === pref) ||
      codes.find((code) => code.toLowerCase().split('-')[0] === pref.split('-')[0]);
    if (match) return match;
  }
  return codes.includes(fallback) ? fallback : codes[0] || fallback;
}

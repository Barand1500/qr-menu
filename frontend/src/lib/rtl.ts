/** Sağdan sola (RTL) yazılan diller */

const RTL_LANGS = new Set([
  'ar', // Arapça
  'fa', // Farsça
  'he', // İbranice
  'ur', // Urduca
  'ps', // Peştuca
  'ckb', // Kürtçe (Sorani)
  'ku', // Kürtçe (bazı lehçeler)
  'yi', // Yidiş
]);

export function isRtlLanguage(code?: string | null): boolean {
  if (!code) return false;
  const base = code.toLowerCase().split('-')[0];
  return RTL_LANGS.has(base);
}

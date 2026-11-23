// Şema saf bir modüldür: yönetim, menü ve sunucu aynı doğrulamayı kullanır.
export {
  CONTACT_CARD_DEFAULTS,
  CONTACT_CARD_TONES,
  SIGNATURE_BOX,
  contactCardHasContent,
  contactCardMapUrl,
  contactCardWhatsappUrl,
  normalizeContactCard,
} from '../../../backend/src/lib/contact-card';
export type { ContactCardConfig, ContactCardTone } from '../../../backend/src/lib/contact-card';

import { SIGNATURE_BOX } from '../../../backend/src/lib/contact-card';

export type SignaturePoint = { x: number; y: number };

/** Kartın renk takımları. `light` true ise kart açık renklidir. */
export const CONTACT_CARD_PALETTES = {
  ember: { name: 'Köz', bg: ['#1f130b', '#33190c'], ink: '#f6eee4', muted: '#b9a595', accent: '#ff6b2c', accent2: '#ffb44a', paper: '#2a1b12', light: false },
  night: { name: 'Gece', bg: ['#0b1220', '#18274a'], ink: '#eef2ff', muted: '#9aa7c7', accent: '#60a5fa', accent2: '#a78bfa', paper: '#142039', light: false },
  forest: { name: 'Orman', bg: ['#0b1a13', '#133322'], ink: '#ecfdf5', muted: '#8fb3a0', accent: '#34d399', accent2: '#bef264', paper: '#102a1d', light: false },
  royal: { name: 'Kraliyet', bg: ['#1a0f2e', '#33195c'], ink: '#faf5ff', muted: '#b9a4d6', accent: '#c084fc', accent2: '#f0abfc', paper: '#271446', light: false },
  ivory: { name: 'Fildişi', bg: ['#f8f2e7', '#eadcc2'], ink: '#1f1710', muted: '#7a6a58', accent: '#b45309', accent2: '#d97706', paper: '#fffaf0', light: true },
} as const;

/** Yoldaki sayılardan yaklaşık uzunluk (görünür kutu birimiyle). */
export function strokeLength(path: string): number {
  const nums = (path.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
  let length = 0;
  for (let i = 2; i + 1 < nums.length; i += 2) {
    length += Math.hypot(nums[i] - nums[i - 2], nums[i + 1] - nums[i - 1]);
  }
  return length;
}

/** Çizgiler sırayla çizilir; süre uzunlukla orantılıdır. */
export function signatureTimeline(strokes: string[], startDelay = 0) {
  let at = startDelay;
  const items = strokes.map((d) => {
    const duration = Math.min(1.4, Math.max(0.35, strokeLength(d) / 650));
    const item = { d, delay: at, duration };
    at += duration + 0.08;
    return item;
  });
  return { items, end: items.length ? at - 0.08 : startDelay };
}

const r1 = (n: number) => Math.round(n * 10) / 10;

/** Kaba fare/parmak noktalarını yumuşak, kısa bir SVG yoluna çevirir (en çok ~3800 karakter). */
export function buildStrokePath(points: SignaturePoint[]): string {
  if (!points.length) return '';
  const clamp = (p: SignaturePoint) => ({
    x: Math.min(SIGNATURE_BOX.width, Math.max(0, p.x)),
    y: Math.min(SIGNATURE_BOX.height, Math.max(0, p.y)),
  });
  const all = points.map(clamp);
  if (all.length === 1) return `M ${r1(all[0].x)} ${r1(all[0].y)} L ${r1(all[0].x + 0.1)} ${r1(all[0].y)}`;
  for (let min = 2; min <= 40; min += 2) {
    const kept = [all[0]];
    for (let i = 1; i < all.length - 1; i++) {
      const last = kept[kept.length - 1];
      if (Math.hypot(all[i].x - last.x, all[i].y - last.y) >= min) kept.push(all[i]);
    }
    kept.push(all[all.length - 1]);
    let d = `M ${r1(kept[0].x)} ${r1(kept[0].y)}`;
    for (let i = 1; i < kept.length - 1; i++) {
      const mx = (kept[i].x + kept[i + 1].x) / 2,
        my = (kept[i].y + kept[i + 1].y) / 2;
      d += ` Q ${r1(kept[i].x)} ${r1(kept[i].y)} ${r1(mx)} ${r1(my)}`;
    }
    const end = kept[kept.length - 1];
    d += ` L ${r1(end.x)} ${r1(end.y)}`;
    if (d.length <= 3800) return d;
  }
  return '';
}

/** Kart numarası: restoran adından üretilen kısa, sabit görsel kod (yalnızca süs). */
export function cardNumber(seed: string): string {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619) >>> 0;
  const s = h.toString(10).padStart(10, '0');
  return `${s.slice(0, 4)} ${s.slice(4, 8)}`;
}

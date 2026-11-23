// İletişim kartı: restoranın kimlik kartı gibi görünen iletişim sayfası.
// Saf modül: yönetim paneli, herkese açık menü ve sunucu aynı doğrulamayı kullanır.

export const CONTACT_CARD_KEY = 'contact_card';

export const CONTACT_CARD_TONES = ['ember', 'night', 'forest', 'royal', 'ivory'] as const;
export type ContactCardTone = (typeof CONTACT_CARD_TONES)[number];

/** İmza çizimi bu koordinat kutusunda tutulur (genişlik × yükseklik). */
export const SIGNATURE_BOX = { width: 900, height: 460 } as const;
const MAX_STROKES = 12;
const MAX_STROKE_LENGTH = 4000;

export type ContactCardConfig = {
  enabled: boolean;
  tone: ContactCardTone;
  tagline: string;
  managerName: string;
  managerTitle: string;
  phone: string;
  whatsapp: string;
  email: string;
  website: string;
  address: string;
  /** Google Maps vb. konum bağlantısı. Boşsa adresten arama bağlantısı üretilir. */
  mapUrl: string;
  /** Haritadan seçilen nokta (ikisi birlikte dolu ya da ikisi de boş) */
  lat: number | null;
  lng: number | null;
  /** Arama sonucundan gelen ayrıntılı adres (kartta adresin altında görünür) */
  placeLabel: string;
  hours: string;
  /** Her çizgi ayrı SVG yoludur (M/L/Q komutları), sırayla çizilir. */
  signature: string[];
};

export const CONTACT_CARD_DEFAULTS: ContactCardConfig = {
  enabled: false,
  tone: 'ember',
  tagline: '',
  managerName: '',
  managerTitle: '',
  phone: '',
  whatsapp: '',
  email: '',
  website: '',
  address: '',
  mapUrl: '',
  lat: null,
  lng: null,
  placeLabel: '',
  hours: '',
  signature: [],
};

const text = (value: unknown, max: number) =>
  typeof value === 'string' ? value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max) : '';

/** Telefon: rakam, boşluk, +, parantez ve tire kalır. */
const phone = (value: unknown) => text(value, 30).replace(/[^\d+()\s-]/g, '').trim();

const email = (value: unknown) => {
  const v = text(value, 120);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? v : '';
};

/** Yalnızca http(s) bağlantısı kabul edilir; şemasız yazılanlara https eklenir. */
const link = (value: unknown, max: number) => {
  const v = text(value, max);
  if (!v) return '';
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString().slice(0, max) : '';
  } catch {
    return '';
  }
};

/** Yol yalnızca çizim komutları ve sayı içerebilir; başka her şey atılır. */
const strokePath = (value: unknown) => {
  if (typeof value !== 'string') return '';
  const v = value.trim();
  if (!v || v.length > MAX_STROKE_LENGTH) return '';
  if (!/^[MLQ\d\s.,-]+$/.test(v) || !v.startsWith('M')) return '';
  return v;
};

/** Enlem/boylam: geçerli aralıkta iki sayı; aksi halde konum yok sayılır. */
function coordinates(lat: unknown, lng: unknown): { lat: number | null; lng: number | null } {
  const a = typeof lat === 'number' ? lat : NaN;
  const b = typeof lng === 'number' ? lng : NaN;
  if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) return { lat: null, lng: null };
  return { lat: Math.round(a * 1e6) / 1e6, lng: Math.round(b * 1e6) / 1e6 };
}

export function normalizeContactCard(input: unknown): ContactCardConfig {
  const s = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const tone = CONTACT_CARD_TONES.includes(s.tone as ContactCardTone)
    ? (s.tone as ContactCardTone)
    : CONTACT_CARD_DEFAULTS.tone;
  const signature = Array.isArray(s.signature)
    ? s.signature.map(strokePath).filter(Boolean).slice(0, MAX_STROKES)
    : [];
  return {
    enabled: s.enabled === true,
    tone,
    tagline: text(s.tagline, 80),
    managerName: text(s.managerName, 60),
    managerTitle: text(s.managerTitle, 60),
    phone: phone(s.phone),
    whatsapp: phone(s.whatsapp),
    email: email(s.email),
    website: link(s.website, 200),
    address: text(s.address, 200),
    mapUrl: link(s.mapUrl, 500),
    ...coordinates(s.lat, s.lng),
    placeLabel: text(s.placeLabel, 160),
    hours: text(s.hours, 80),
    signature,
  };
}

export function parseContactCard(raw?: string | null): ContactCardConfig {
  if (!raw) return { ...CONTACT_CARD_DEFAULTS };
  try {
    return normalizeContactCard(JSON.parse(raw));
  } catch {
    return { ...CONTACT_CARD_DEFAULTS };
  }
}

export function serializeContactCard(config: ContactCardConfig): string {
  return JSON.stringify(normalizeContactCard(config));
}

/** Kartta gösterilecek bir şey var mı? (Tamamen boş kart müşteriye açılmaz.) */
export function contactCardHasContent(config: ContactCardConfig): boolean {
  return Boolean(
    config.managerName ||
      config.phone ||
      config.whatsapp ||
      config.email ||
      config.website ||
      config.address ||
      config.mapUrl ||
      config.lat !== null ||
      config.hours,
  );
}

/** Konum bağlantısı: yazılmış bağlantı, yoksa haritadaki nokta, yoksa adresten Google Maps araması. */
export function contactCardMapUrl(
  config: Pick<ContactCardConfig, 'mapUrl' | 'address'> & { lat?: number | null; lng?: number | null },
): string {
  if (config.mapUrl) return config.mapUrl;
  if (typeof config.lat === 'number' && typeof config.lng === 'number') {
    return `https://www.google.com/maps/search/?api=1&query=${config.lat},${config.lng}`;
  }
  if (config.address) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.address)}`;
  }
  return '';
}

/** WhatsApp bağlantısı: yalnızca rakamlar; 0 ile başlayan Türkiye numarası 90'a çevrilir. */
export function contactCardWhatsappUrl(value: string): string {
  let digits = value.replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('00')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = `90${digits.slice(1)}`;
  return `https://wa.me/${digits}`;
}

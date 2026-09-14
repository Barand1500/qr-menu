export const TIME_MENU_KEY = 'time_menu';

export type TimeMenuSlot = {
  id: string;
  name: string;
  start: string;
  end: string;
  enabled: boolean;
};

export type TimeMenuRule = {
  slotId: string;
  productId: number;
  hidden?: boolean;
  featured?: boolean;
  price?: number | null;
};

export type TimeMenuConfig = {
  enabled: boolean;
  timezone: string;
  slots: TimeMenuSlot[];
  rules: TimeMenuRule[];
};

const DEFAULT_SLOTS: TimeMenuSlot[] = [
  { id: 'morning', name: 'Sabah', start: '08:00', end: '11:00', enabled: true },
  { id: 'lunch', name: 'Öğle', start: '11:00', end: '16:00', enabled: true },
  { id: 'dinner', name: 'Akşam', start: '16:00', end: '23:00', enabled: true },
];

export const DEFAULT_TIME_MENU_CONFIG: TimeMenuConfig = {
  enabled: false,
  timezone: 'Europe/Istanbul',
  slots: DEFAULT_SLOTS.map((s) => ({ ...s })),
  rules: [],
};

function isHhMm(value: unknown): value is string {
  return typeof value === 'string' && /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function newSlotId() {
  return `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createCustomSlot(partial?: Partial<TimeMenuSlot>): TimeMenuSlot {
  return {
    id: partial?.id || newSlotId(),
    name: partial?.name?.trim() || 'Özel dilim',
    start: isHhMm(partial?.start) ? partial!.start! : '10:00',
    end: isHhMm(partial?.end) ? partial!.end! : '12:00',
    enabled: partial?.enabled !== false,
  };
}

function parseSlots(raw: unknown): TimeMenuSlot[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_SLOTS.map((s) => ({ ...s }));
  }
  const slots: TimeMenuSlot[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const start = isHhMm(o.start) ? o.start : '08:00';
    const end = isHhMm(o.end) ? o.end : '11:00';
    const name = String(o.name ?? '').trim() || 'Dilim';
    const id = String(o.id ?? '').trim() || newSlotId();
    slots.push({
      id,
      name,
      start,
      end,
      enabled: o.enabled !== false,
    });
  }
  return slots.length ? slots : DEFAULT_SLOTS.map((s) => ({ ...s }));
}

function parseRules(raw: unknown): TimeMenuRule[] {
  if (!Array.isArray(raw)) return [];
  const out: TimeMenuRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const o = item as Record<string, unknown>;
    const slotId = String(o.slotId ?? '').trim();
    const productId = Number(o.productId);
    if (!slotId || !Number.isFinite(productId) || productId <= 0) continue;
    const priceRaw = o.price;
    let price: number | null | undefined;
    if (priceRaw === null || priceRaw === '') price = null;
    else if (priceRaw != null && Number.isFinite(Number(priceRaw))) {
      price = Math.max(0, Number(priceRaw));
    }
    const rule: TimeMenuRule = { slotId, productId };
    if (o.hidden === true) rule.hidden = true;
    if (o.featured === true) rule.featured = true;
    if (price !== undefined) rule.price = price;
    if (!rule.hidden && !rule.featured && (rule.price == null || rule.price === undefined)) {
      continue;
    }
    out.push(rule);
  }
  return out;
}

export function parseTimeMenuConfig(raw?: string | null): TimeMenuConfig {
  if (!raw) return { ...DEFAULT_TIME_MENU_CONFIG, slots: DEFAULT_SLOTS.map((s) => ({ ...s })) };
  try {
    const data = JSON.parse(raw) as Partial<TimeMenuConfig>;
    return {
      enabled: data.enabled === true,
      timezone:
        typeof data.timezone === 'string' && data.timezone.trim()
          ? data.timezone.trim()
          : 'Europe/Istanbul',
      slots: parseSlots(data.slots),
      rules: parseRules(data.rules),
    };
  } catch {
    return { ...DEFAULT_TIME_MENU_CONFIG, slots: DEFAULT_SLOTS.map((s) => ({ ...s })) };
  }
}

export function normalizeTimeMenuConfig(config: TimeMenuConfig): TimeMenuConfig {
  return parseTimeMenuConfig(JSON.stringify(config));
}

export function getActiveSlot(
  config: TimeMenuConfig,
  now: Date = new Date()
): TimeMenuSlot | null {
  if (!config.enabled) return null;
  const minutes = localMinutesInTz(now, config.timezone);
  for (const slot of config.slots) {
    if (!slot.enabled) continue;
    const [sh, sm] = slot.start.split(':').map(Number);
    const [eh, em] = slot.end.split(':').map(Number);
    const start = sh * 60 + sm;
    const end = eh * 60 + em;
    if (start === end) continue;
    if (start < end) {
      if (minutes >= start && minutes < end) return slot;
    } else if (minutes >= start || minutes < end) {
      return slot;
    }
  }
  return null;
}

function localMinutesInTz(date: Date, timeZone: string): number {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
    const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
    return hour * 60 + minute;
  } catch {
    return date.getHours() * 60 + date.getMinutes();
  }
}

export function rulesForSlot(
  config: TimeMenuConfig,
  slotId: string
): Map<number, TimeMenuRule> {
  const map = new Map<number, TimeMenuRule>();
  for (const rule of config.rules) {
    if (rule.slotId !== slotId) continue;
    map.set(rule.productId, rule);
  }
  return map;
}

/** Kayıtta sadece anlamlı kuralları bırak */
export function compactRules(rules: TimeMenuRule[]): TimeMenuRule[] {
  return rules.filter(
    (r) =>
      r.hidden === true ||
      r.featured === true ||
      (r.price != null && Number.isFinite(r.price))
  );
}

export function findOverlappingSlots(slots: TimeMenuSlot[]): string[] {
  const enabled = slots.filter((s) => s.enabled);
  const warnings: string[] = [];
  for (let i = 0; i < enabled.length; i++) {
    for (let j = i + 1; j < enabled.length; j++) {
      const a = enabled[i];
      const b = enabled[j];
      if (rangesOverlap(a.start, a.end, b.start, b.end)) {
        warnings.push(`“${a.name}” ile “${b.name}” çakışıyor`);
      }
    }
  }
  return warnings;
}

function rangesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  const as = toMin(aStart);
  const ae = toMin(aEnd);
  const bs = toMin(bStart);
  const be = toMin(bEnd);
  const aSpans = as < ae ? [[as, ae]] : [[as, 24 * 60], [0, ae]];
  const bSpans = bs < be ? [[bs, be]] : [[bs, 24 * 60], [0, be]];
  for (const [x0, x1] of aSpans) {
    for (const [y0, y1] of bSpans) {
      if (x0 < y1 && y0 < x1) return true;
    }
  }
  return false;
}

function toMin(hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

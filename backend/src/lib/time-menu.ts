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

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

function newSlotId() {
  return `slot_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

export function serializeTimeMenuConfig(config: TimeMenuConfig): string {
  return JSON.stringify(parseTimeMenuConfig(JSON.stringify(config)));
}

/** Aktif dilim: listedeki ilk eşleşen (çakışmada öncelik). midnight-spanning destekler. */
export function getActiveSlot(
  config: TimeMenuConfig,
  now: Date = new Date()
): TimeMenuSlot | null {
  if (!config.enabled) return null;
  const minutes = localMinutesInTz(now, config.timezone);
  for (const slot of config.slots) {
    if (!slot.enabled) continue;
    const start = toMinutes(slot.start);
    const end = toMinutes(slot.end);
    if (start === end) continue;
    if (start < end) {
      if (minutes >= start && minutes < end) return slot;
    } else {
      // örn. 22:00–02:00
      if (minutes >= start || minutes < end) return slot;
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

export type TimeMenuProductPatch = {
  hidden: boolean;
  isRecommended?: boolean;
  price?: number;
};

export function patchProductForSlot(
  _productId: number,
  base: { isRecommended?: boolean; price?: number },
  rule: TimeMenuRule | undefined
): TimeMenuProductPatch {
  const hidden = rule?.hidden === true;
  const featured = rule?.featured === true;
  const patch: TimeMenuProductPatch = { hidden };
  if (featured) patch.isRecommended = true;
  else if (base.isRecommended != null) patch.isRecommended = base.isRecommended;
  if (rule?.price != null && Number.isFinite(rule.price)) {
    patch.price = rule.price;
  } else if (base.price != null) {
    patch.price = base.price;
  }
  return patch;
}

export type TimeMenuRuntime = {
  config: TimeMenuConfig;
  slot: TimeMenuSlot | null;
  rules: Map<number, TimeMenuRule>;
};

/** Prisma setting row value → runtime */
export function buildTimeMenuRuntime(raw: string | null | undefined): TimeMenuRuntime {
  const config = parseTimeMenuConfig(raw ?? null);
  const slot = getActiveSlot(config);
  const rules = slot ? rulesForSlot(config, slot.id) : new Map<number, TimeMenuRule>();
  return { config, slot, rules };
}

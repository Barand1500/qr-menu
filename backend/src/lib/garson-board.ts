import type { PresenceSummary } from './table-presence.js';
// Garson paneli: masa panosu (çağrı, QR, uğranma) ve garsonların "gidiyorum / uğradım / hallettim" kayıtları.
// Saf mantık burada; veritabanı okuma/yazma ayrı (garson-board-store.ts). Şema değişikliği gerekmez.

export const GARSON_KEY = 'garson_board_v1';
/** "Ben gidiyorum" işareti bu süre sonra kendiliğinden düşer (garson unutursa masa kilitli kalmasın). */
export const CLAIM_TTL_MS = 20 * 60 * 1000;
/** Dolu bir masaya bu süredir uğranmadıysa "uğranmalı" sayılır. */
export const VISIT_DUE_MS = 15 * 60 * 1000;
export const VISIT_REMINDER_KEY = 'garson_visit_reminder_minutes';
export const DEFAULT_VISIT_REMINDER_MIN = 15;

/** Garson telefonunun servis türüne göre titreşimi (yönetici seçer). Sunucu yalnızca kimlikleri saklar. */
export const VIBRATION_KEY = 'garson_vibration';
export const VIBRATION_IDS = ['off', 'short', 'double', 'triple', 'long'] as const;
export const DEFAULT_VIBRATION: Record<'waiter' | 'bill' | 'hookah' | 'valet' | 'order', (typeof VIBRATION_IDS)[number]> = {
  waiter: 'double',
  bill: 'short',
  hookah: 'triple',
  valet: 'long',
  order: 'double',
};
export function parseVibration(raw: unknown): typeof DEFAULT_VIBRATION {
  let src: unknown = raw;
  if (typeof raw === 'string') {
    try {
      src = JSON.parse(raw);
    } catch {
      src = null;
    }
  }
  const out = { ...DEFAULT_VIBRATION };
  if (src && typeof src === 'object') {
    for (const key of Object.keys(out) as (keyof typeof out)[]) {
      const v = (src as Record<string, unknown>)[key];
      if (typeof v === 'string' && (VIBRATION_IDS as readonly string[]).includes(v)) out[key] = v as (typeof VIBRATION_IDS)[number];
    }
  }
  return out;
}

/** Ayar değeri: yok → varsayılan 15 dk; 0 → hatırlatma kapalı; 5–180 dk arası. */
export function parseVisitReminderMinutes(raw?: string | null): number {
  if (raw == null || raw === '') return DEFAULT_VISIT_REMINDER_MIN;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return DEFAULT_VISIT_REMINDER_MIN;
  if (n <= 0) return 0;
  return Math.min(180, Math.max(5, n));
}
export const VISIT_LATE_MS = 30 * 60 * 1000;
const EVENT_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_EVENTS = 400;
const FEED_WINDOW_MS = 6 * 60 * 60 * 1000;

export type GarsonEventKind = 'visit' | 'claim' | 'unclaim' | 'done';
export type GarsonEvent = {
  id: string;
  k: GarsonEventKind;
  t: number;
  g: string;
  n: string;
  u: number;
  w: string;
  r?: number;
};
export type Claim = { u: number; w: string; t: number };
export type CodeHandoff = { u: number; w: string; t: number; g: string; n: string };
export type GarsonStore = { events: GarsonEvent[]; claims: Record<string, Claim>; handoffs: Record<string, CodeHandoff> };

export const emptyStore = (): GarsonStore => ({ events: [], claims: {}, handoffs: {} });

const isObject = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const KINDS: GarsonEventKind[] = ['visit', 'claim', 'unclaim', 'done'];

export function parseStore(raw?: string | null): GarsonStore {
  if (!raw) return emptyStore();
  try {
    const json = JSON.parse(raw) as unknown;
    if (!isObject(json)) return emptyStore();
    const events = (Array.isArray(json.events) ? json.events : [])
      .filter(isObject)
      .map((e): GarsonEvent | null => {
        if (!KINDS.includes(e.k as GarsonEventKind)) return null;
        if (typeof e.t !== 'number' || typeof e.n !== 'string' || typeof e.u !== 'number') return null;
        return {
          id: String(e.id || ''),
          k: e.k as GarsonEventKind,
          t: e.t,
          g: typeof e.g === 'string' ? e.g : '',
          n: e.n,
          u: e.u,
          w: typeof e.w === 'string' ? e.w : '',
          ...(typeof e.r === 'number' ? { r: e.r } : {}),
        };
      })
      .filter((e): e is GarsonEvent => e !== null);
    const claims: Record<string, Claim> = {};
    if (isObject(json.claims)) {
      for (const [id, c] of Object.entries(json.claims)) {
        if (isObject(c) && typeof c.u === 'number' && typeof c.t === 'number') {
          claims[id] = { u: c.u, w: typeof c.w === 'string' ? c.w : '', t: c.t };
        }
      }
    }
    const handoffs: Record<string, CodeHandoff> = {};
    if (isObject(json.handoffs)) {
      for (const [id, h] of Object.entries(json.handoffs)) {
        if (/^\d+$/.test(id) && isObject(h) && typeof h.u === 'number' && typeof h.t === 'number' && typeof h.g === 'string' && typeof h.n === 'string') {
          handoffs[id] = { u: h.u, w: typeof h.w === 'string' ? h.w : '', t: h.t, g: h.g, n: h.n };
        }
      }
    }
    return { events, claims, handoffs };
  } catch {
    return emptyStore();
  }
}

/** Eski kayıtları ve süresi dolmuş işaretleri ayıklayıp yazılacak metni üretir. */
export function serializeStore(store: GarsonStore, now: number): string {
  const events = store.events.filter((e) => now - e.t < EVENT_TTL_MS).slice(-MAX_EVENTS);
  const claims: Record<string, Claim> = {};
  for (const [id, c] of Object.entries(store.claims)) if (now - c.t < CLAIM_TTL_MS) claims[id] = c;
  const handoffs = Object.fromEntries(Object.entries(store.handoffs || {})
    .filter(([, h]) => now - h.t < EVENT_TTL_MS)
    .sort((a, b) => b[1].t - a[1].t).slice(0, MAX_EVENTS));
  return JSON.stringify({ events, claims, handoffs });
}

let counter = 0;
const eventId = (now: number) => `${now.toString(36)}${(counter++ % 1296).toString(36)}`;

export function logEvent(
  store: GarsonStore,
  ev: Omit<GarsonEvent, 'id' | 't'>,
  now: number,
): GarsonStore {
  return { ...store, events: [...store.events, { ...ev, id: eventId(now), t: now }] };
}

export function activeClaim(store: GarsonStore, requestId: number, now: number): Claim | null {
  const c = store.claims[String(requestId)];
  return c && now - c.t < CLAIM_TTL_MS ? c : null;
}

type Who = { u: number; w: string };
type Where = { g: string; n: string };

/** "Ben gidiyorum": başkası zaten gidiyorsa reddedilir ve kim olduğu söylenir. */
export function tryClaim(
  store: GarsonStore,
  requestId: number,
  who: Who,
  where: Where,
  now: number,
  force = false,
): { store: GarsonStore; ok: boolean; by?: Claim } {
  const existing = activeClaim(store, requestId, now);
  if (existing && existing.u !== who.u && !force) return { store, ok: false, by: existing };
  const claims = { ...store.claims, [String(requestId)]: { u: who.u, w: who.w, t: now } };
  const next = logEvent({ ...store, claims }, { k: 'claim', ...where, u: who.u, w: who.w, r: requestId }, now);
  return { store: next, ok: true };
}

/** Vazgeçme ya da "hallettim": işareti kaldırır ve kaydı düşer. */
export function releaseClaim(
  store: GarsonStore,
  requestId: number,
  who: Who,
  where: Where,
  now: number,
  done: boolean,
): GarsonStore {
  const { [String(requestId)]: _gone, ...claims } = store.claims;
  return logEvent({ ...store, claims }, { k: done ? 'done' : 'unclaim', ...where, u: who.u, w: who.w, r: requestId }, now);
}

/** Masaya en son kim, ne zaman uğradı ("uğradım" ya da çağrıyı hallettim). */
export function lastVisit(store: GarsonStore, group: string, table: string): { w: string; t: number; u: number } | null {
  let best: GarsonEvent | null = null;
  for (const e of store.events) {
    if ((e.k === 'visit' || e.k === 'done') && e.g === group && e.n === table && (!best || e.t > best.t)) best = e;
  }
  return best ? { w: best.w, t: best.t, u: best.u } : null;
}

/** Handoff belongs to a session, not a reusable table number. First visitor keeps it. */
export function codeHandoff(store: GarsonStore, sessionId: number, group: string, table: string): CodeHandoff | null {
  const h = store.handoffs?.[String(sessionId)];
  return h && h.g === group && h.n === table ? h : null;
}

export function assignCodeHandoff(store: GarsonStore, sessionId: number, who: Who, where: Where, now: number) {
  const by = codeHandoff(store, sessionId, where.g, where.n);
  if (by) return { store, ok: by.u === who.u, by };
  const handoff = { ...who, ...where, t: now };
  const next = logEvent({ ...store, handoffs: { ...store.handoffs, [String(sessionId)]: handoff } }, { k: 'visit', ...where, ...who }, now);
  return { store: next, ok: true, by: handoff };
}

// ───── pano ─────

export type GroupIn = {
  slug: string;
  name: string;
  /** Masa kodu önekleri için önceden hesaplanmış kodlar ve adlar */
  tables: { code: string; name: string }[];
};
export type OrderRowIn = { name: string; variant: string; qty: number; line: number; at: number; note: string; paid: boolean };

export type SessionIn = {
  id: number;
  group: string;
  table: string;
  status: string; // open | reserved
  openedAt: number;
  openedBy: string; // qr | admin
  guestName: string | null;
  codeStatus: 'empty' | 'pending' | 'verified' | 'expired';
  activity?: PresenceSummary[];
  prefs?: string[];
  orders?: OrderRowIn[];
  accessCode?: string | null;
  codeExpiresAt?: number | null;
  codeVerifiedAt?: number | null;
  total: number;
  itemCount: number;
  waiterName: string | null;
};
export type RequestIn = {
  id: number;
  type: string;
  group: string;
  table: string;
  note: string | null;
  orderJson: string | null;
  isRead: boolean;
  at: number;
};

export type BoardCall = {
  id: number;
  type: 'waiter' | 'bill' | 'hookah' | 'valet' | 'order';
  label: string;
  note: string;
  items: { name: string; qty: number; variant: string }[];
  at: number;
  claim: { name: string; at: number; mine: boolean } | null;
};
export type BoardTable = {
  key: string;
  group: string;
  groupName: string;
  code: string;
  label: string;
  state: 'call' | 'busy' | 'reserved' | 'empty';
  calls: BoardCall[];
  session: {
    id: number;
    activity: PresenceSummary[];
    prefs: string[];
    orders: OrderRowIn[];
    code: string | null;
    codeExpiresAt: number | null;
    codeVerifiedAt: number | null;
    handoff: { mine: boolean; name: string; at: number } | null;
    openedAt: number;
    scanned: boolean;
    codeStatus: SessionIn['codeStatus'];
    guestName: string | null;
    total: number;
    itemCount: number;
    waiterName: string | null;
  } | null;
  lastVisit: { name: string; at: number; mine: boolean } | null;
  /** fresh: yakın zamanda uğrandı · due: uğranma zamanı geldi · late: çok bekledi · none: dolu değil */
  visit: 'fresh' | 'due' | 'late' | 'none';
};
export type FeedItem = {
  id: string;
  at: number;
  kind: 'waiter' | 'bill' | 'hookah' | 'valet' | 'order' | 'scan' | 'visit' | 'claim' | 'done' | 'unclaim' | 'verified';
  table: string;
  text: string;
  who: string;
};

const CALL_LABEL: Record<BoardCall['type'], string> = {
  waiter: 'Garson çağırdı',
  bill: 'Hesap istedi',
  hookah: 'Nargileci çağırdı',
  valet: 'Vale çağırdı',
  order: 'Sipariş verdi',
};

/** "Pizza (Büyük, Peynirli)" → ürün adı ve seçenek özeti ayrı gösterilebilsin */
export function splitVariant(raw: string): { name: string; variant: string } {
  const m = /^(.*?)\s*\(([^()]{1,120})\)\s*$/.exec(raw);
  if (!m || !m[1].trim()) return { name: raw, variant: '' };
  return { name: m[1].trim(), variant: m[2].trim() };
}

export function parseOrder(json: string | null): { items: { name: string; qty: number; variant: string }[]; note: string } {
  if (!json) return { items: [], note: '' };
  try {
    const data = JSON.parse(json) as { items?: unknown; note?: unknown };
    const items = (Array.isArray(data.items) ? data.items : [])
      .filter(isObject)
      .map((i) => ({ ...splitVariant(String(i.name || '').slice(0, 120)), qty: Math.max(1, Math.round(Number(i.qty) || 1)) }))
      .filter((i) => i.name);
    return { items, note: typeof data.note === 'string' ? data.note.slice(0, 300) : '' };
  } catch {
    return { items: [], note: '' };
  }
}

function callType(r: RequestIn): BoardCall['type'] {
  if (r.type === 'bill') return 'bill';
  if (r.type === 'hookah') return 'hookah';
  if (r.type === 'valet') return 'valet';
  return r.orderJson ? 'order' : 'waiter';
}

export function buildBoard(input: {
  groups: GroupIn[];
  sessions: SessionIn[];
  requests: RequestIn[];
  store: GarsonStore;
  me: { id: number; name: string };
  now: number;
  codeGateEnabled?: boolean;
  /** Dolu masaya uğrama hatırlatması (dakika); 0 = kapalı */
  visitMinutes?: number;
}) {
  const { groups, sessions, requests, store, me, now, codeGateEnabled = false } = input;
  const visitMinutes = input.visitMinutes ?? DEFAULT_VISIT_REMINDER_MIN;
  const dueMs = visitMinutes * 60_000;
  const lateMs = dueMs * 2;
  const keyOf = (g: string, n: string) => `${g}::${n}`;
  const sessionBy = new Map(sessions.map((s) => [keyOf(s.group, s.table), s]));

  const callsBy = new Map<string, BoardCall[]>();
  for (const r of requests) {
    if (r.isRead) continue;
    const type = callType(r);
    const order = parseOrder(r.orderJson);
    const claim = activeClaim(store, r.id, now);
    const call: BoardCall = {
      id: r.id,
      type,
      label: CALL_LABEL[type],
      note: (r.note || order.note || '').slice(0, 300),
      items: order.items,
      at: r.at,
      claim: claim ? { name: claim.w, at: claim.t, mine: claim.u === me.id } : null,
    };
    const k = keyOf(r.group, r.table);
    callsBy.set(k, [...(callsBy.get(k) || []), call]);
  }
  for (const list of callsBy.values()) list.sort((a, b) => a.at - b.at);

  const known = new Set<string>();
  const tables: BoardTable[] = [];
  const makeTable = (group: string, groupName: string, code: string, name: string): BoardTable => {
    const k = keyOf(group, code);
    known.add(k);
    const s = sessionBy.get(k) || null;
    const calls = callsBy.get(k) || [];
    const handoff = s && codeGateEnabled ? codeHandoff(store, s.id, group, code) : null;
    // Önceki oturumlardan kalan uğrama kayıtları sayılmaz: masa kapanınca / yeni oturum açılınca sıfırlanır
    const lvAll = s ? lastVisit(store, group, code) : null;
    const lv = lvAll && lvAll.t >= s!.openedAt ? lvAll : null;
    const occupied = Boolean(s);
    let visit: BoardTable['visit'] = 'none';
    if (occupied && dueMs > 0) {
      // Hiç uğranmamışsa oturumun açıldığı andan itibaren say
      const since = Math.max(lv?.t ?? 0, s!.openedAt);
      const age = now - since;
      visit = age >= lateMs ? 'late' : age >= dueMs ? 'due' : 'fresh';
    }
    return {
      key: k,
      group,
      groupName,
      code,
      label: name,
      state: calls.length ? 'call' : s ? (s.status === 'reserved' ? 'reserved' : 'busy') : 'empty',
      calls,
      session: s
        ? {
            id: s.id,
            activity: s.activity || [],
            prefs: s.prefs || [],
            orders: s.orders || [],
            code: codeGateEnabled && handoff?.u === me.id && s.codeStatus === 'pending' ? s.accessCode || null : null,
            codeExpiresAt: s.codeExpiresAt ?? null,
            codeVerifiedAt: s.codeVerifiedAt ?? null,
            handoff: handoff ? { mine: handoff.u === me.id, name: handoff.w, at: handoff.t } : null,
            openedAt: s.openedAt,
            scanned: s.openedBy === 'qr',
            codeStatus: s.codeStatus,
            guestName: s.guestName,
            total: s.total,
            itemCount: s.itemCount,
            waiterName: s.waiterName,
          }
        : null,
      lastVisit: lv ? { name: lv.w, at: lv.t, mine: lv.u === me.id } : null,
      visit,
    };
  };

  for (const g of groups) for (const t of g.tables) tables.push(makeTable(g.slug, g.name, t.code, t.name));

  // Gruplarda tanımsız ama çağrısı/oturumu olan masalar da görünsün
  const extra = new Map<string, { group: string; code: string }>();
  for (const s of sessions) if (!known.has(keyOf(s.group, s.table))) extra.set(keyOf(s.group, s.table), { group: s.group, code: s.table });
  for (const r of requests) if (!r.isRead && !known.has(keyOf(r.group, r.table))) extra.set(keyOf(r.group, r.table), { group: r.group, code: r.table });
  for (const { group, code } of extra.values()) tables.push(makeTable(group, 'Diğer', code, `Masa ${code}`));

  const labelOf = new Map(tables.map((t) => [t.key, t.label]));
  const label = (g: string, n: string) => labelOf.get(keyOf(g, n)) || `Masa ${n}`;

  const feed: FeedItem[] = [];
  for (const r of requests) {
    if (now - r.at > FEED_WINDOW_MS) continue;
    const type = callType(r);
    feed.push({ id: `r${r.id}`, at: r.at, kind: type, table: label(r.group, r.table), text: CALL_LABEL[type], who: '' });
  }
  for (const s of sessions) {
    if (s.codeVerifiedAt && now - s.codeVerifiedAt <= FEED_WINDOW_MS) {
      feed.push({ id: `v${s.id}:${s.codeVerifiedAt}`, at: s.codeVerifiedAt, kind: 'verified', table: label(s.group, s.table), text: 'Masa kodu doğrulandı', who: '' });
    }
    if (s.openedBy === 'qr' && now - s.openedAt <= FEED_WINDOW_MS) {
      feed.push({ id: `s${s.id}`, at: s.openedAt, kind: 'scan', table: label(s.group, s.table), text: 'QR kodu okuttu', who: '' });
    }
  }
  const VERB: Record<GarsonEventKind, string> = {
    visit: 'masaya uğradı',
    claim: 'çağrıya gidiyor',
    unclaim: 'çağrıdan vazgeçti',
    done: 'çağrıyı hallesti',
  };
  for (const e of store.events) {
    if (now - e.t > FEED_WINDOW_MS) continue;
    feed.push({ id: `e${e.id}`, at: e.t, kind: e.k, table: label(e.g, e.n), text: VERB[e.k], who: e.w });
  }
  feed.sort((a, b) => b.at - a.at);

  const open = tables.filter((t) => t.calls.length);
  return {
    tables,
    feed: feed.slice(0, 60),
    counts: {
      calls: open.reduce((n, t) => n + t.calls.length, 0),
      callTables: open.length,
      busy: tables.filter((t) => t.state === 'busy' || t.state === 'call' || t.state === 'reserved').length,
      due: tables.filter((t) => t.visit === 'due' || t.visit === 'late').length,
      mine: tables.reduce((n, t) => n + t.calls.filter((c) => c.claim?.mine).length, 0),
    },
  };
}

export const tableKeyValid = (group: unknown, table: unknown): { g: string; n: string } | null => {
  const g = typeof group === 'string' ? group.trim() : '';
  const n = typeof table === 'string' ? table.trim() : '';
  if (!/^[a-z0-9-]{0,100}$/i.test(g) || !/^[a-z0-9-]{1,40}$/i.test(n)) return null;
  return { g, n };
};

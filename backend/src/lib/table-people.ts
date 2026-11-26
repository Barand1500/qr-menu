// Masa oturumunda "kim var, kim ne yaptı" kaydı. Saf mantık (veritabanı yok); oturumun meta alanında saklanır, şema değişmez.
//
// • people: oturuma katılan telefonlar, katılış sırasıyla. İlk telefon "masa sahibi"dir (kod açıksa kodu giren).
//   Tarayıcıda rastgele üretilen kimlik saklanır; kişi adı, konum vb. yok. Garsona yalnızca "1. kişi, 2. kişi" gider.
// • log: çağrı, sipariş, garson hareketleri. Çağrı satırları silinse de oturum geçmişi kalır.

export type Person = { v: string; t: number; s: number };
export type LogKind = 'join' | 'verify' | 'call' | 'repeat' | 'order' | 'visit' | 'claim' | 'unclaim' | 'done' | 'close';
export type LogEntry = {
  t: number;
  k: LogKind;
  /** kişi sırası (1 = ilk telefon) */
  p?: number;
  /** çağrı türü */
  ty?: string;
  /** çağrı kaydı numarası */
  r?: number;
  /** garson adı */
  w?: string;
  /** ürün adedi */
  n?: number;
  /** tutar */
  a?: number;
};
type Raw = Record<string, unknown>;

export const MAX_PEOPLE = 40;
export const MAX_LOG = 300;
const ID_RE = /^[a-zA-Z0-9-]{8,80}$/;
const KINDS: LogKind[] = ['join', 'verify', 'call', 'repeat', 'order', 'visit', 'claim', 'unclaim', 'done', 'close'];

export const cleanVisitorId = (raw: unknown): string | null => (typeof raw === 'string' && ID_RE.test(raw) ? raw : null);
const isObj = (v: unknown): v is Raw => Boolean(v) && typeof v === 'object' && !Array.isArray(v);
const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function parsePeople(raw: unknown): Person[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: Person[] = [];
  for (const p of raw) {
    if (!isObj(p) || typeof p.v !== 'string' || !ID_RE.test(p.v) || seen.has(p.v)) continue;
    const t = num(p.t);
    if (t === undefined) continue;
    seen.add(p.v);
    out.push({ v: p.v, t, s: num(p.s) ?? t });
  }
  return out.slice(0, MAX_PEOPLE);
}

export function parseLog(raw: unknown): LogEntry[] {
  if (!Array.isArray(raw)) return [];
  const out: LogEntry[] = [];
  for (const e of raw) {
    if (!isObj(e) || !KINDS.includes(e.k as LogKind)) continue;
    const t = num(e.t);
    if (t === undefined) continue;
    const entry: LogEntry = { t, k: e.k as LogKind };
    const p = num(e.p);
    const r = num(e.r);
    const n = num(e.n);
    const a = num(e.a);
    if (p !== undefined) entry.p = p;
    if (r !== undefined) entry.r = r;
    if (n !== undefined) entry.n = n;
    if (a !== undefined) entry.a = a;
    if (typeof e.ty === 'string') entry.ty = e.ty.slice(0, 20);
    if (typeof e.w === 'string') entry.w = e.w.slice(0, 80);
    out.push(entry);
  }
  return out.slice(-MAX_LOG);
}

/** Günlüğe satır ekler (en çok MAX_LOG; en eski satırlar düşer). */
export function appendLog(raw: Raw, entry: LogEntry): Raw {
  return { ...raw, log: [...parseLog(raw.log), entry].slice(-MAX_LOG) };
}

export type JoinResult = { raw: Raw; changed: boolean; index: number; owner: boolean; isNew: boolean; people: number };

/**
 * Telefonu oturuma ekler. İlk gelen masa sahibidir. `verify`: masa kodu bu telefonda girildi; kod kapısı açıksa
 * sahip, ilk onaylayandır (kodu garsondan alan kişi).
 */
export function joinPerson(raw: Raw, visitorId: string, now: number, opts: { verify?: boolean } = {}): JoinResult {
  const people = parsePeople(raw.people);
  let next: Raw = raw;
  let changed = false;
  let index = people.findIndex((p) => p.v === visitorId) + 1;
  const isNew = index === 0;
  if (isNew) {
    if (people.length >= MAX_PEOPLE) return { raw, changed: false, index: 0, owner: false, isNew: false, people: people.length };
    people.push({ v: visitorId, t: now, s: now });
    index = people.length;
    next = appendLog({ ...next, people }, { t: now, k: 'join', p: index });
    changed = true;
  } else if (now - people[index - 1].s > 60_000) {
    people[index - 1] = { ...people[index - 1], s: now };
    next = { ...next, people };
    changed = true;
  }
  if (opts.verify && typeof next.verifiedBy !== 'string') {
    next = appendLog({ ...next, owner: visitorId, verifiedBy: visitorId }, { t: now, k: 'verify', p: index });
    changed = true;
  }
  const owner = (typeof next.owner === 'string' ? next.owner : people[0]?.v) === visitorId;
  return { raw: next, changed, index, owner, isNew, people: people.length };
}

/** Çağrı için ek basış kaydı; aynı kişi aynı çağrıyı tekrar basarsa gürültü yapmaz. */
export function logRepeat(raw: Raw, personIndex: number, type: string, requestId: number, now: number): { raw: Raw; changed: boolean } {
  const log = parseLog(raw.log);
  const first = log.find((e) => (e.k === 'call' || e.k === 'order') && e.r === requestId);
  if (!personIndex || first?.p === personIndex || log.some((e) => e.k === 'repeat' && e.r === requestId && e.p === personIndex)) return { raw, changed: false };
  return { raw: appendLog(raw, { t: now, k: 'repeat', p: personIndex, ty: type, r: requestId }), changed: true };
}

/** Bu çağrıyı ilk kim yaptı (kişi sırası). */
export function callPerson(raw: Raw, requestId: number): number | undefined {
  return parseLog(raw.log).find((e) => (e.k === 'call' || e.k === 'order') && e.r === requestId)?.p;
}

/** Çağrı başına "kaç kişi daha basmış". */
export function repeatCounts(log: LogEntry[]): Record<number, number> {
  const out: Record<number, number> = {};
  for (const e of log) if (e.k === 'repeat' && e.r !== undefined) out[e.r] = (out[e.r] || 0) + 1;
  return out;
}

// ───── okunabilir geçmiş ─────

/** 90 sn → "2 dk", 3700 sn → "1 sa 2 dk"; bir dakikadan azsa "1 dk'dan az". */
export function dur(ms: number): string {
  const m = Math.round(Math.max(0, ms) / 60000);
  if (m < 1) return "1 dk'dan az";
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return `${h} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
}

const CALL_TEXT: Record<string, string> = {
  waiter: 'garson çağırdı',
  bill: 'hesap istedi',
  hookah: 'nargile istedi',
  valet: 'vale istedi',
};
const money = (n: number) => `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

export type HistoryKind = 'open' | 'join' | 'call' | 'bill' | 'order' | 'repeat' | 'claim' | 'unclaim' | 'done' | 'visit' | 'pay' | 'close';
export type HistoryItem = { id: string; t: number; kind: HistoryKind; callType?: string; text: string; who?: string; ms?: number; p?: number };
export type CallStat = { id: number; type: string; at: number; person: number; repeats: number; claimBy: string | null; claimMs: number | null; doneBy: string | null; doneMs: number | null };
export type HistorySummary = {
  id: number;
  group: string;
  table: string;
  label: string;
  status: string;
  openedAt: number;
  closedAt: number | null;
  durationMs: number;
  people: number;
  calls: number;
  avgClaimMs: number | null;
  slowClaimMs: number | null;
  billAt: number | null;
  paidAt: number | null;
  billToCloseMs: number | null;
  total: number;
  itemCount: number;
  closedBy: string | null;
  callList: CallStat[];
};

export type HistoryInput = {
  session: { id: number; group: string; table: string; status: string; openedAt: number; closedAt: number | null; openedBy: string };
  label: string;
  meta: Raw;
  /** Garsonun (yönetimden) eklediği siparişler: müşteri siparişleri zaten günlükte. */
  staffOrders: { at: number; qty: number }[];
  payments: { at: number; amount: number; method: string }[];
  total: number;
  itemCount: number;
  now: number;
};

const METHOD: Record<string, string> = { cash: 'nakit', card: 'kart', mixed: 'karışık' };

export function buildHistory(input: HistoryInput): { summary: HistorySummary; timeline: HistoryItem[] } {
  const { session, meta, now } = input;
  const people = parsePeople(meta.people);
  const log = parseLog(meta.log);
  const ownerId = typeof meta.owner === 'string' ? meta.owner : people[0]?.v;
  const ownerNo = people.findIndex((p) => p.v === ownerId) + 1;
  const who = (p?: number) => (p ? `${p}. kişi${p === ownerNo ? ' (masa sahibi)' : ''}` : 'Bir müşteri');

  // çağrı → ilk "gidiyorum" / "hallettim" süreleri
  const stats = new Map<number, CallStat>();
  for (const e of log) {
    if ((e.k === 'call' || e.k === 'order') && e.r !== undefined && !stats.has(e.r)) {
      stats.set(e.r, { id: e.r, type: e.k === 'order' ? 'order' : e.ty || 'waiter', at: e.t, person: e.p || 0, repeats: 0, claimBy: null, claimMs: null, doneBy: null, doneMs: null });
    }
  }
  for (const e of log) {
    const s = e.r !== undefined ? stats.get(e.r) : undefined;
    if (!s) continue;
    if (e.k === 'repeat') s.repeats++;
    if (e.k === 'claim' && s.claimMs === null) {
      s.claimMs = Math.max(0, e.t - s.at);
      s.claimBy = e.w || null;
    }
    if (e.k === 'done' && s.doneMs === null) {
      s.doneMs = Math.max(0, e.t - s.at);
      s.doneBy = e.w || null;
    }
  }

  const items: HistoryItem[] = [];
  items.push({ id: 'open', t: session.openedAt, kind: 'open', text: session.openedBy === 'admin' ? 'Masa yönetimden açıldı' : 'Masa açıldı' });
  log.forEach((e, i) => {
    const id = `l${i}`;
    const s = e.r !== undefined ? stats.get(e.r) : undefined;
    switch (e.k) {
      case 'join':
        items.push({ id, t: e.t, kind: 'join', p: e.p, text: e.p === 1 || e.p === ownerNo ? `${who(e.p)} QR'ı okuttu` : `${who(e.p)} masaya katıldı` });
        break;
      case 'verify':
        items.push({ id, t: e.t, kind: 'join', text: `${who(e.p)} masa kodunu girdi` });
        break;
      case 'call':
        items.push({ id, t: e.t, kind: e.ty === 'bill' ? 'bill' : 'call', callType: e.ty, text: `${who(e.p)} ${CALL_TEXT[e.ty || 'waiter'] || 'çağırdı'}` });
        break;
      case 'repeat':
        items.push({ id, t: e.t, kind: 'repeat', callType: e.ty, text: `${who(e.p)} de aynı çağrıyı yaptı` });
        break;
      case 'order':
        items.push({ id, t: e.t, kind: 'order', callType: 'order', text: `${who(e.p)} sipariş verdi${e.n ? ` · ${e.n} ürün` : ''}${e.a ? ` · ${money(e.a)}` : ''}` });
        break;
      case 'visit':
        items.push({ id, t: e.t, kind: 'visit', who: e.w, text: `${e.w || 'Garson'} masaya uğradı` });
        break;
      case 'claim':
        items.push({ id, t: e.t, kind: 'claim', who: e.w, ms: s?.claimMs ?? undefined, text: `${e.w || 'Garson'} gidiyor${s ? ` · çağrıdan ${dur(e.t - s.at)} sonra` : ''}` });
        break;
      case 'unclaim':
        items.push({ id, t: e.t, kind: 'unclaim', who: e.w, text: `${e.w || 'Garson'} çağrıdan vazgeçti` });
        break;
      case 'done':
        items.push({ id, t: e.t, kind: 'done', who: e.w, text: `${e.w || 'Garson'} çağrıyı halletti${s ? ` · çağrıdan ${dur(e.t - s.at)} sonra` : ''}` });
        break;
      case 'close':
        break;
    }
  });
  const staff = new Map<number, number>();
  for (const o of input.staffOrders) if (o.at) staff.set(o.at, (staff.get(o.at) || 0) + o.qty);
  [...staff.entries()].forEach(([t, qty], i) => items.push({ id: `s${i}`, t, kind: 'order', callType: 'order', text: `Garson siparişi ekledi · ${qty} ürün` }));
  input.payments.forEach((p, i) => items.push({ id: `p${i}`, t: p.at, kind: 'pay', text: `Ödeme alındı · ${money(p.amount)}${METHOD[p.method] ? ` (${METHOD[p.method]})` : ''}` }));
  const closeEntry = [...log].reverse().find((e) => e.k === 'close');
  const closedAt = session.closedAt;
  const end = closedAt ?? now;
  if (closedAt) {
    items.push({
      id: 'close',
      t: closedAt,
      kind: 'close',
      who: closeEntry?.w,
      text: `Masa kapandı${closeEntry?.w ? ` · ${closeEntry.w} kapattı` : ''} · toplam oturum ${dur(closedAt - session.openedAt)}`,
    });
  }
  items.sort((a, b) => a.t - b.t);
  // Kalabalık masada art arda katılımlar tek satır olsun ("2.–10. kişi masaya katıldı")
  const merged: HistoryItem[] = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.kind === 'join' && it.p && it.text.endsWith('masaya katıldı')) {
      let j = i;
      while (j + 1 < items.length && items[j + 1].kind === 'join' && items[j + 1].p && items[j + 1].text.endsWith('masaya katıldı')) j++;
      if (j - i >= 2) {
        merged.push({ ...it, text: `${it.p}.–${items[j].p}. kişi masaya katıldı (${j - i + 1} kişi)` });
        i = j;
        continue;
      }
    }
    merged.push(it);
  }

  const callList = [...stats.values()].sort((a, b) => a.at - b.at);
  const claimed = callList.filter((c) => c.claimMs !== null).map((c) => c.claimMs as number);
  const billAt = callList.find((c) => c.type === 'bill')?.at ?? null;
  const paidAt = input.payments.length ? Math.max(...input.payments.map((p) => p.at)) : null;
  return {
    timeline: merged,
    summary: {
      id: session.id,
      group: session.group,
      table: session.table,
      label: input.label,
      status: session.status,
      openedAt: session.openedAt,
      closedAt,
      durationMs: Math.max(0, end - session.openedAt),
      people: people.length,
      calls: callList.length,
      avgClaimMs: claimed.length ? Math.round(claimed.reduce((a, b) => a + b, 0) / claimed.length) : null,
      slowClaimMs: claimed.length ? Math.max(...claimed) : null,
      billAt,
      paidAt,
      billToCloseMs: billAt && closedAt ? Math.max(0, closedAt - billAt) : null,
      total: input.total,
      itemCount: input.itemCount,
      closedBy: closeEntry?.w || null,
      callList,
    },
  };
}

import { prisma } from './prisma.js';
import { ACTIVE_STATUSES, findActiveSession } from './table-floor.js';
import { appendLog, joinPerson, logRepeat, type LogEntry } from './table-people.js';

type Raw = Record<string, unknown>;

/**
 * Oturum meta'sını okuyup değiştirir; aynı anda başka biri yazdıysa değeri yeniden okuyup birkaç kez dener.
 * `fn` değişiklik yoksa changed=false döner ve yazılmaz.
 */
export async function mutateSessionMeta<T>(
  restaurantId: number,
  sessionId: number,
  fn: (raw: Raw) => { raw: Raw; changed: boolean; result: T },
  opts: { allowClosed?: boolean } = {},
): Promise<T | null> {
  for (let attempt = 0; attempt < 5; attempt++) {
    const session = await prisma.tableFloorSession.findFirst({
      where: { id: sessionId, restaurantId, ...(opts.allowClosed ? {} : { status: { in: [...ACTIVE_STATUSES] } }) },
      select: { id: true, metaJson: true },
    });
    if (!session) return null;
    let raw: Raw = {};
    try {
      const parsed = JSON.parse(session.metaJson || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) raw = parsed as Raw;
    } catch {
      /* eski boş meta */
    }
    const out = fn(raw);
    if (!out.changed) return out.result;
    const done = await prisma.tableFloorSession.updateMany({ where: { id: session.id, restaurantId, metaJson: session.metaJson }, data: { metaJson: JSON.stringify(out.raw) } });
    if (done.count) return out.result;
  }
  return null;
}

export type PersonInfo = { index: number; owner: boolean; people: number; isNew: boolean };

/** Telefonu oturuma kaydeder (ilk telefon masa sahibi). Hata olursa sessizce null: asıl işlem etkilenmesin. */
export async function recordPerson(restaurantId: number, sessionId: number, visitorId: string | null, opts: { verify?: boolean } = {}): Promise<PersonInfo | null> {
  if (!visitorId) return null;
  try {
    const now = Date.now();
    return await mutateSessionMeta<PersonInfo>(restaurantId, sessionId, (raw) => {
      const j = joinPerson(raw, visitorId, now, opts);
      return { raw: j.raw, changed: j.changed, result: { index: j.index, owner: j.owner, people: j.people, isNew: j.isNew } };
    });
  } catch {
    return null;
  }
}

export async function logSession(restaurantId: number, sessionId: number, entry: Omit<LogEntry, 't'>, opts: { allowClosed?: boolean } = {}) {
  try {
    await mutateSessionMeta(restaurantId, sessionId, (raw) => ({ raw: appendLog(raw, { ...entry, t: Date.now() }), changed: true, result: true }), opts);
  } catch {
    /* günlük en iyi çabayla yazılır */
  }
}

/** Aynı masanın şu anki açık oturumuna garson hareketini yazar. */
export async function logTable(restaurantId: number, group: string | null, table: string, entry: Omit<LogEntry, 't'>) {
  try {
    const session = await findActiveSession(restaurantId, table, group || null);
    if (session) await logSession(restaurantId, session.id, entry);
  } catch {
    /* en iyi çaba */
  }
}

export async function logRepeatCall(restaurantId: number, sessionId: number, personIndex: number, type: string, requestId: number) {
  try {
    const now = Date.now();
    await mutateSessionMeta(restaurantId, sessionId, (raw) => {
      const r = logRepeat(raw, personIndex, type, requestId, now);
      return { raw: r.raw, changed: r.changed, result: true };
    });
  } catch {
    /* en iyi çaba */
  }
}

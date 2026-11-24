// Garson paneli: sunucudan gelen pano verisinin tipleri ve küçük yardımcılar.

export type CallType = 'waiter' | 'bill' | 'hookah' | 'valet' | 'order';

export type BoardCall = {
  id: number;
  type: CallType;
  label: string;
  note: string;
  items: { name: string; qty: number }[];
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
    openedAt: number;
    scanned: boolean;
    codeStatus: 'empty' | 'pending' | 'verified' | 'expired';
    guestName: string | null;
    total: number;
    itemCount: number;
    waiterName: string | null;
  } | null;
  lastVisit: { name: string; at: number; mine: boolean } | null;
  visit: 'fresh' | 'due' | 'late' | 'none';
};

export type FeedKind = CallType | 'scan' | 'visit' | 'claim' | 'done' | 'unclaim';
export type FeedItem = { id: string; at: number; kind: FeedKind; table: string; text: string; who: string };

export type Board = {
  now: number;
  restaurant: string;
  me: { id: number; name: string };
  hasTables: boolean;
  tables: BoardTable[];
  feed: FeedItem[];
  counts: { calls: number; callTables: number; busy: number; due: number; mine: number };
};

/** "az önce", "3 dk", "1 sa 5 dk" */
export function ago(ms: number): string {
  const m = Math.floor(Math.max(0, ms) / 60000);
  if (m < 1) return 'az önce';
  if (m < 60) return `${m} dk`;
  const h = Math.floor(m / 60);
  return `${h} sa${m % 60 ? ` ${m % 60} dk` : ''}`;
}

/** "3 dk önce" (ilk dakikada yalnızca "az önce") */
export const since = (ms: number): string => {
  const t = ago(ms);
  return t === 'az önce' ? t : `${t} önce`;
};

/** Çağrının bekleme süresine göre aciliyet: sakin, dikkat, acil */
export function urgency(waitMs: number): 'calm' | 'warn' | 'hot' {
  const m = waitMs / 60000;
  return m >= 5 ? 'hot' : m >= 2 ? 'warn' : 'calm';
}

export const clock = (t: number) =>
  new Date(t).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

export const money = (n: number) =>
  `${n.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`;

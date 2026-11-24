/** Short-lived screen presence. No account, location, search text or cart contents. */
export const PRESENCE_TTL_MS = 75_000;
export const PRESENCE_KINDS = ['welcome', 'menu', 'category', 'product', 'cart', 'game', 'code'] as const;
export type PresenceKind = (typeof PRESENCE_KINDS)[number];
export type PresenceClient = { id: string; kind: PresenceKind; label: string; at: number };
export type PresenceSummary = { kind: PresenceKind; label: string; count: number; at: number };
export function parsePresence(raw: unknown, now = Date.now()): PresenceClient[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is PresenceClient => Boolean(v) && typeof v === 'object' && /^[a-zA-Z0-9-]{8,80}$/.test(v.id) && PRESENCE_KINDS.includes(v.kind) && typeof v.at === 'number' && Number.isFinite(v.at) && v.at <= now + 5000 && now - v.at < PRESENCE_TTL_MS)
    .map(v => ({ id: v.id, kind: v.kind, label: typeof v.label === 'string' && (v.kind === 'category' || v.kind === 'product' || v.kind === 'game') ? v.label.replace(/\s+/g, ' ').trim().slice(0, 64) : '', at: v.at }))
    .sort((a, b) => b.at - a.at).slice(0, 12);
}
export function updatePresence(raw: unknown, client: PresenceClient, active: boolean, now = Date.now()) {
  const entries = parsePresence(raw, now).filter(v => v.id !== client.id);
  return parsePresence(active ? [{ ...client, at: now }, ...entries] : entries, now);
}
export function summarizePresence(raw: unknown, now = Date.now()): PresenceSummary[] {
  const groups = new Map<string, PresenceSummary>();
  for (const v of parsePresence(raw, now)) {
    const key = `${v.kind}:${v.label}`;
    const previous = groups.get(key);
    if (previous) previous.count++;
    else groups.set(key, { kind: v.kind, label: v.label, count: 1, at: v.at });
  }
  return [...groups.values()];
}

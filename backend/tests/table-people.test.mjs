import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.garson-check/people.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/table-people.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const p = await import(pathToFileURL(out).href);

const T = 1_000_000_000_000;
const MIN = 60_000;

// 10 kişi aynı masaya oturur: ilk gelen sahip, sıra korunur, aynı telefon tekrar eklenmez
let raw = {};
const ids = Array.from({ length: 10 }, (_, i) => `visitor-${String(i).padStart(4, '0')}`);
const infos = [];
ids.forEach((id, i) => {
  const j = p.joinPerson(raw, id, T + i * 1000);
  raw = j.raw;
  infos.push(j);
});
assert.deepEqual(infos.map((i) => i.index), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
assert.equal(infos[0].owner, true);
assert.equal(infos[1].owner, false);
assert.equal(infos[9].people, 10);
const again = p.joinPerson(raw, ids[3], T + 5000);
assert.equal(again.index, 4);
assert.equal(again.isNew, false);
assert.equal(again.changed, false); // 60 sn dolmadan yazı gerekmez
assert.equal(p.joinPerson(raw, ids[3], T + 90_000).changed, true); // 60 sn sonra "son görülme" yenilenir

// kod kapısı: kodu giren ilk kişi sahip olur (ilk tarayan değil)
let g = p.joinPerson({}, 'visitor-aaaa1', T);
g = p.joinPerson(g.raw, 'visitor-bbbb2', T + 1000);
g = p.joinPerson(g.raw, 'visitor-bbbb2', T + 2000, { verify: true });
assert.equal(g.owner, true);
assert.equal(p.joinPerson(g.raw, 'visitor-aaaa1', T + 3000).owner, false);
// ikinci onaylayan sahipliği alamaz
const v2 = p.joinPerson(g.raw, 'visitor-aaaa1', T + 4000, { verify: true });
assert.equal(v2.owner, false);

// geçersiz kimlik ve üst sınır
assert.equal(p.cleanVisitorId('kısa'), null);
assert.equal(p.cleanVisitorId('visitor-ok-1234'), 'visitor-ok-1234');
let many = {};
for (let i = 0; i < 60; i++) many = p.joinPerson(many, `visitor-${String(i).padStart(4, '0')}`, T + i).raw;
assert.equal(p.parsePeople(many.people).length, p.MAX_PEOPLE);

// tekrar basış: aynı kişi gürültü yapmaz, başka kişi sayılır
let log = p.appendLog({}, { t: T, k: 'call', p: 1, ty: 'waiter', r: 7 });
assert.equal(p.logRepeat(log, 1, 'waiter', 7, T + 1000).changed, false);
const r2 = p.logRepeat(log, 2, 'waiter', 7, T + 1000);
assert.equal(r2.changed, true);
assert.equal(p.logRepeat(r2.raw, 2, 'waiter', 7, T + 2000).changed, false);
assert.equal(p.repeatCounts(p.parseLog(r2.raw.log))[7], 1);
assert.equal(p.callPerson(log, 7), 1);

// oturum geçmişi: çağrı → gidiyor → halletti, hesap, ödeme, kapanış, süreler
let meta = p.joinPerson({}, 'visitor-aaaa1', T).raw;
meta = p.joinPerson(meta, 'visitor-bbbb2', T + 2 * MIN).raw;
meta = p.appendLog(meta, { t: T + 10 * MIN, k: 'call', p: 2, ty: 'waiter', r: 1 });
meta = p.appendLog(meta, { t: T + 10 * MIN + 30_000, k: 'repeat', p: 1, ty: 'waiter', r: 1 });
meta = p.appendLog(meta, { t: T + 13 * MIN, k: 'claim', w: 'Ayşe', r: 1 });
meta = p.appendLog(meta, { t: T + 15 * MIN, k: 'done', w: 'Ayşe', r: 1 });
meta = p.appendLog(meta, { t: T + 20 * MIN, k: 'order', p: 1, r: 2, n: 3, a: 290 });
meta = p.appendLog(meta, { t: T + 70 * MIN, k: 'call', p: 1, ty: 'bill', r: 3 });
meta = p.appendLog(meta, { t: T + 72 * MIN, k: 'claim', w: 'Mehmet', r: 3 });
meta = p.appendLog(meta, { t: T + 80 * MIN, k: 'close', w: 'Mehmet' });
const h = p.buildHistory({
  session: { id: 5, group: 'salon', table: '5', status: 'closed', openedAt: T, closedAt: T + 80 * MIN, openedBy: 'qr' },
  label: 'Salon 5',
  meta,
  staffOrders: [],
  payments: [{ at: T + 76 * MIN, amount: 290, method: 'cash' }],
  total: 290,
  itemCount: 3,
  now: T + 90 * MIN,
});
assert.equal(h.summary.durationMs, 80 * MIN);
assert.equal(h.summary.people, 2);
assert.equal(h.summary.calls, 3); // garson çağrısı, sipariş, hesap
const waiter = h.summary.callList.find((c) => c.id === 1);
assert.equal(waiter.claimMs, 3 * MIN);
assert.equal(waiter.doneMs, 5 * MIN);
assert.equal(waiter.repeats, 1);
assert.equal(waiter.claimBy, 'Ayşe');
assert.equal(h.summary.billAt, T + 70 * MIN);
assert.equal(h.summary.billToCloseMs, 10 * MIN);
assert.equal(h.summary.paidAt, T + 76 * MIN);
assert.equal(h.summary.closedBy, 'Mehmet');
assert.equal(h.summary.avgClaimMs, Math.round((3 * MIN + 2 * MIN) / 2));
const kinds = h.timeline.map((i) => i.kind);
assert.equal(kinds[0], 'open');
assert.equal(kinds.at(-1), 'close');
assert.ok(h.timeline.every((it, i, a) => i === 0 || a[i - 1].t <= it.t), 'zaman sırası');
assert.ok(h.timeline.some((i) => i.text.includes('1. kişi (masa sahibi)')));
assert.ok(h.timeline.some((i) => i.text.includes('Ayşe gidiyor · çağrıdan 3 dk sonra')));
assert.ok(h.timeline.at(-1).text.includes('toplam oturum 1 sa 20 dk'));

// 10 kişi art arda katıldıysa zaman çizelgesi tek satıra indirir
let crowd = {};
for (let i = 0; i < 10; i++) crowd = p.joinPerson(crowd, `visitor-${String(i).padStart(4, '0')}`, T + i * 1000).raw;
const ch = p.buildHistory({ session: { id: 9, group: '', table: '2', status: 'open', openedAt: T, closedAt: null, openedBy: 'qr' }, label: 'Masa 2', meta: crowd, staffOrders: [], payments: [], total: 0, itemCount: 0, now: T + MIN });
assert.equal(ch.timeline.length, 3); // açıldı + 1. kişi + 2.–10. kişi
assert.equal(ch.timeline[2].text, '2.–10. kişi masaya katıldı (9 kişi)');

// açık oturum: kapanış yok, süre şimdiye kadar
const open = p.buildHistory({ session: { id: 6, group: '', table: '1', status: 'open', openedAt: T, closedAt: null, openedBy: 'admin' }, label: 'Masa 1', meta: {}, staffOrders: [{ at: T + MIN, qty: 2 }], payments: [], total: 0, itemCount: 2, now: T + 30 * MIN });
assert.equal(open.summary.durationMs, 30 * MIN);
assert.equal(open.summary.closedAt, null);
assert.equal(open.timeline[0].text, 'Masa yönetimden açıldı');
assert.ok(open.timeline.some((i) => i.text === 'Garson siparişi ekledi · 2 ürün'));

// bozuk veri çökertmez
assert.deepEqual(p.parsePeople('x'), []);
assert.deepEqual(p.parseLog([{ k: 'nope', t: 1 }, null, { k: 'call', t: 'a' }]), []);
console.log('table-people testleri geçti');

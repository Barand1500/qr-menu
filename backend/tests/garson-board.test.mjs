import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.garson-check/lib.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/garson-board.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm' });
const g = await import(pathToFileURL(out).href);

const MIN = 60_000;
const now = 1_000_000_000_000;
const ali = { u: 1, w: 'Ali' };
const ayse = { u: 2, w: 'Ayşe' };

// ── gidiyorum: ilk garson alır, ikinci reddedilir ve kimin gittiği söylenir
let store = g.emptyStore();
const r = g.tryClaim(store, 7, ali, { g: 'bahce', n: '5' }, now);
assert.equal(r.ok, true);
store = r.store;
const denied = g.tryClaim(store, 7, ayse, { g: 'bahce', n: '5' }, now + MIN);
assert.equal(denied.ok, false);
assert.equal(denied.by.w, 'Ali');
assert.equal(denied.store, store, 'reddedilince kayıt değişmez');
assert.equal(g.tryClaim(store, 7, ayse, { g: 'bahce', n: '5' }, now + MIN, true).ok, true, 'zorla alınabilir');
assert.equal(g.tryClaim(store, 7, ali, { g: 'bahce', n: '5' }, now + MIN).ok, true, 'kendi işaretini yeniler');
// 20 dakika sonra işaret kendiliğinden düşer
assert.equal(g.activeClaim(store, 7, now + 21 * MIN), null);
assert.equal(g.tryClaim(store, 7, ayse, { g: 'bahce', n: '5' }, now + 21 * MIN).ok, true);

// ── hallettim: işaret kalkar, masaya uğranmış sayılır
const done = g.releaseClaim(store, 7, ali, { g: 'bahce', n: '5' }, now + 2 * MIN, true);
assert.equal(g.activeClaim(done, 7, now + 2 * MIN), null);
assert.equal(g.lastVisit(done, 'bahce', '5').w, 'Ali');
// vazgeçmek uğramak sayılmaz
const gave = g.releaseClaim(store, 7, ali, { g: 'bahce', n: '5' }, now + 2 * MIN, false);
assert.equal(g.lastVisit(gave, 'bahce', '5'), null);
// uğradım: en son kim
let v = g.logEvent(g.emptyStore(), { k: 'visit', g: 'salon', n: '1', u: 1, w: 'Ali' }, now);
v = g.logEvent(v, { k: 'visit', g: 'salon', n: '1', u: 2, w: 'Ayşe' }, now + 5 * MIN);
assert.equal(g.lastVisit(v, 'salon', '1').w, 'Ayşe');
assert.equal(g.lastVisit(v, 'salon', '2'), null);

// ── saklama: kaydet-oku turu, bozuk veri, eski kayıt ayıklama
assert.equal(g.parseStore(g.serializeStore(v, now + 6 * MIN)).events.length, 2);
assert.deepEqual(g.parseStore('{bozuk'), g.emptyStore());
assert.equal(g.parseStore(g.serializeStore(v, now + 25 * 60 * MIN)).events.length, 0, '24 saatten eskiler atılır');
assert.equal(Object.keys(g.parseStore(g.serializeStore(store, now + 30 * MIN)).claims).length, 0, 'süresi dolan işaret atılır');

// ── pano
const groups = [{ slug: 'bahce', name: 'Bahçe', tables: [{ code: '1', name: 'Bahçe 1' }, { code: '2', name: 'Bahçe 2' }, { code: '3', name: 'Bahçe 3' }] }];
const sessions = [
  { id: 1, group: 'bahce', table: '1', status: 'open', openedAt: now - 40 * MIN, openedBy: 'qr', guestName: null, codeStatus: 'verified', total: 250, itemCount: 3, waiterName: null },
  { id: 2, group: 'bahce', table: '2', status: 'open', openedAt: now - 3 * MIN, openedBy: 'qr', guestName: null, codeStatus: 'pending', total: 0, itemCount: 0, waiterName: null },
  { id: 3, group: 'teras', table: '9', status: 'open', openedAt: now - 2 * MIN, openedBy: 'admin', guestName: 'Can', codeStatus: 'empty', total: 0, itemCount: 0, waiterName: 'Veli' },
];
const requests = [
  { id: 7, type: 'waiter', group: 'bahce', table: '3', note: null, orderJson: JSON.stringify({ items: [{ name: 'Çay', qty: 2 }, { name: 'Su', qty: 1 }], note: 'şekersiz' }), isRead: false, at: now - 4 * MIN },
  { id: 8, type: 'bill', group: 'bahce', table: '1', note: null, orderJson: null, isRead: false, at: now - 1 * MIN },
  { id: 9, type: 'waiter', group: 'bahce', table: '2', note: null, orderJson: null, isRead: true, at: now - 30 * MIN },
  { id: 10, type: 'valet', group: 'bahce', table: '99', note: 'Plaka: 34 ABC 123', orderJson: null, isRead: false, at: now - 2 * MIN },
];
let st = g.tryClaim(g.emptyStore(), 7, ayse, { g: 'bahce', n: '3' }, now - 2 * MIN).store;
st = g.logEvent(st, { k: 'visit', g: 'bahce', n: '1', u: 1, w: 'Ali' }, now - 10 * MIN);
const board = g.buildBoard({ groups, sessions, requests, store: st, me: { id: 1, name: 'Ali' }, now });
const by = (k) => board.tables.find((t) => t.key === k);

assert.equal(by('bahce::3').state, 'call');
assert.equal(by('bahce::3').calls[0].label, 'Sipariş verdi');
assert.deepEqual(by('bahce::3').calls[0].items, [{ name: 'Çay', variant: '', qty: 2 }, { name: 'Su', variant: '', qty: 1 }]);
// seçenekli ürün: ad ve seçenek özeti ayrılır
assert.deepEqual(g.splitVariant('Pizza (Büyük, Peynirli)'), { name: 'Pizza', variant: 'Büyük, Peynirli' });
assert.deepEqual(g.splitVariant('Çay'), { name: 'Çay', variant: '' });
assert.deepEqual(g.parseOrder(JSON.stringify({ items: [{ name: 'Kahve (Orta)', qty: 1 }] })).items, [{ name: 'Kahve', variant: 'Orta', qty: 1 }]);
assert.equal(by('bahce::3').calls[0].note, 'şekersiz');
assert.equal(by('bahce::3').calls[0].claim.name, 'Ayşe');
assert.equal(by('bahce::3').calls[0].claim.mine, false);
assert.equal(by('bahce::1').calls[0].label, 'Hesap istedi');
assert.equal(by('bahce::2').state, 'busy', 'okunmuş çağrı masayı çağrılı yapmaz');
assert.equal(by('bahce::2').session.codeStatus, 'pending');
assert.equal(by('bahce::2').session.scanned, true);
assert.equal(by('bahce::2').lastVisit, null);
assert.equal(by('bahce::1').lastVisit.name, 'Ali');
assert.equal(by('bahce::1').lastVisit.mine, true);
// 40 dk önce açıldı ama 10 dk önce uğrandı → taze; 3 dk önce açılan taze
assert.equal(by('bahce::1').visit, 'fresh');
assert.equal(by('bahce::2').visit, 'fresh');
// tanımsız masalar da görünür
assert.equal(by('teras::9').groupName, 'Diğer');
assert.equal(by('teras::9').session.guestName, 'Can');
assert.equal(by('teras::9').session.waiterName, 'Veli');
assert.equal(by('bahce::99').state, 'call');
assert.equal(by('bahce::99').calls[0].note, 'Plaka: 34 ABC 123');
// uzun süre uğranmayan dolu masa
const late = g.buildBoard({ groups, sessions, requests: [], store: g.emptyStore(), me: { id: 1, name: 'Ali' }, now });
assert.equal(late.tables.find((t) => t.key === 'bahce::1').visit, 'late');
assert.equal(late.tables.find((t) => t.key === 'bahce::3').visit, 'none');
assert.equal(late.counts.due, 1);
// hatırlatma ayarı: kapalı → uğranmalı yok; çok uzun süre → hepsi taze; ayar okuma
const off = g.buildBoard({ groups, sessions, requests: [], store: g.emptyStore(), me: { id: 1, name: 'Ali' }, now, visitMinutes: 0 });
assert.equal(off.counts.due, 0);
assert.ok(off.tables.every((t) => t.visit === 'none'));
const relaxed = g.buildBoard({ groups, sessions, requests: [], store: g.emptyStore(), me: { id: 1, name: 'Ali' }, now, visitMinutes: 180 });
assert.equal(relaxed.counts.due, 0);
// masa kapanınca / yeni oturum açılınca eski uğrama kaydı görünmez
const oldVisit = g.logEvent(g.emptyStore(), { k: 'visit', g: 'bahce', n: '1', u: 1, w: 'Ali' }, now - 90 * MIN);
const closedBoard = g.buildBoard({ groups, sessions: [], requests: [], store: oldVisit, me: { id: 1, name: 'Ali' }, now });
assert.equal(closedBoard.tables.find((t) => t.key === 'bahce::1').lastVisit, null);
assert.equal(closedBoard.tables.find((t) => t.key === 'bahce::1').visit, 'none');
const reopened = g.buildBoard({ groups, sessions: [{ id: 501, group: 'bahce', table: '1', status: 'open', openedAt: now - 5 * MIN, openedBy: 'qr', guestName: null, codeStatus: 'empty', total: 0, itemCount: 0, waiterName: null }], requests: [], store: oldVisit, me: { id: 1, name: 'Ali' }, now });
assert.equal(reopened.tables.find((t) => t.key === 'bahce::1').lastVisit, null, 'önceki oturumun uğraması yeni oturumda görünmez');
// servis titreşimi: geçersiz kimlikler yok sayılır, eksikler varsayılan olur
assert.deepEqual(g.parseVibration(undefined), g.DEFAULT_VIBRATION);
assert.equal(g.parseVibration({ valet: 'off', waiter: 'evil', bill: 'long' }).valet, 'off');
assert.equal(g.parseVibration({ waiter: 'evil' }).waiter, g.DEFAULT_VIBRATION.waiter);
assert.equal(g.parseVibration(JSON.stringify({ hookah: 'short' })).hookah, 'short');
assert.deepEqual(g.parseVibration('{bozuk'), g.DEFAULT_VIBRATION);
assert.equal(g.parseVisitReminderMinutes(undefined), 15);
assert.equal(g.parseVisitReminderMinutes('0'), 0);
assert.equal(g.parseVisitReminderMinutes('2'), 5);
assert.equal(g.parseVisitReminderMinutes('999'), 180);
assert.equal(g.parseVisitReminderMinutes('abc'), 15);
// sayaçlar
assert.equal(board.counts.calls, 3);
assert.equal(board.counts.callTables, 3);
assert.equal(board.counts.mine, 0);
// akış: en yeni en üstte; QR okutma, çağrılar ve garson hareketleri birlikte
assert.ok(board.feed.every((f, i, a) => i === 0 || a[i - 1].at >= f.at));
assert.ok(board.feed.some((f) => f.kind === 'scan' && f.table === 'Bahçe 2'));
assert.ok(board.feed.some((f) => f.kind === 'claim' && f.who === 'Ayşe'));
assert.ok(board.feed.some((f) => f.kind === 'visit' && f.who === 'Ali'));

// doğrulama
assert.deepEqual(g.tableKeyValid('bahce', '5'), { g: 'bahce', n: '5' });
assert.equal(g.tableKeyValid('bahce', ''), null);
assert.equal(g.tableKeyValid('a b', '5'), null);
assert.equal(g.tableKeyValid('', 'a-1').n, 'a-1');
console.log('PASS: garson panosu (gidiyorum, uğradım, hallettim, pano, akış)');

// Code handoffs survive reloads, stay with the first visitor and never leak into another session.
const pendingSession = { ...sessions[1], id: 77, accessCode: '012345', codeExpiresAt: now + 60 * MIN, codeVerifiedAt: null };
let handoff = g.assignCodeHandoff(g.emptyStore(), 77, ali, { g: 'bahce', n: '2' }, now);
assert.equal(handoff.ok, true);
assert.equal(g.assignCodeHandoff(handoff.store, 77, ayse, { g: 'bahce', n: '2' }, now + MIN).ok, false);
assert.equal(g.assignCodeHandoff(handoff.store, 77, ali, { g: 'bahce', n: '2' }, now + MIN).store.events.length, 1);
let restored = g.parseStore(g.serializeStore(handoff.store, now + MIN));
const boardFor = (session, who = 1, enabled = true, store = restored) => g.buildBoard({ groups, sessions: [session], requests: [], store, me: { id: who, name: 'Garson' }, now, codeGateEnabled: enabled });
assert.equal(boardFor(pendingSession).tables.find(t => t.code === '2').session.code, '012345');
assert.equal(boardFor(pendingSession, 2).tables.find(t => t.code === '2').session.code, null);
assert.equal(boardFor(pendingSession, 2).tables.find(t => t.code === '2').session.handoff.name, 'Ali');
assert.equal(boardFor(pendingSession, 1, false).tables.find(t => t.code === '2').session.code, null);
assert.equal(boardFor({ ...pendingSession, id: 78 }).tables.find(t => t.code === '2').session.handoff, null);
assert.equal(boardFor({ ...pendingSession, group: 'teras' }).tables.find(t => t.group === 'teras').session.code, null);
assert.equal(boardFor({ ...pendingSession, codeStatus: 'expired' }).tables.find(t => t.code === '2').session.code, null);
const verifiedBoard = boardFor({ ...pendingSession, codeStatus: 'verified', codeVerifiedAt: now });
assert.equal(verifiedBoard.tables.find(t => t.code === '2').session.code, null);
assert.ok(verifiedBoard.feed.some(f => f.kind === 'verified'));
for (let i = 0; i < 500; i++) restored = g.logEvent(restored, { k: 'visit', g: 'bahce', n: '3', u: 2, w: 'Ayşe' }, now + i);
assert.equal(g.parseStore(g.serializeStore(restored, now + MIN)).handoffs['77'].u, 1, 'unrelated activity cannot evict a pending handoff');
console.log('PASS: masa kodu teslim sahipliği, oturum izolasyonu ve PIN gizliliği');

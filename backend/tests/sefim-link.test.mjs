// Uçtan uca (bellek içi veritabanı): panel kodu → Çırak eşleşir → görüntü gönderir → menü güncellenir.
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import express from 'express';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.garson-check/sefim-routes.mjs');
await build({
  entryPoints: [path.join(root, 'src/routes/sefim.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  packages: 'external',
  logLevel: 'error',
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  plugins: [
    {
      name: 'memory-db',
      setup(b) {
        b.onResolve({ filter: /\/prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'test' }));
        b.onResolve({ filter: /\/lib\/auth\.js$/ }, () => ({ path: 'auth', namespace: 'test' }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, (a) => ({
          loader: 'js',
          contents:
            a.path === 'prisma'
              ? 'export const prisma = globalThis.__db;'
              : "export const authRequired=(req,res,next)=>{if(!req.headers['x-user'])return res.sendStatus(401);req.user={userId:1,restaurantId:Number(req.headers['x-restaurant']||1)};next();};export const getRestaurantId=async req=>req.user?.restaurantId??null;",
        }));
      },
    },
  ],
});

// ── basit bellek içi Prisma
const tables = { sefimLink: [], sefimMap: [], group: [], product: [], currency: [], restaurant: [{ id: 1, name: 'Test Dürüm' }] };
let seq = 100;
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const matches = (row, where = {}) =>
  Object.entries(where).every(([k, v]) => {
    if (k === 'restaurantId_kind_sefimKey') return row.restaurantId === v.restaurantId && row.kind === v.kind && row.sefimKey === v.sefimKey;
    if (v && typeof v === 'object' && !(v instanceof Date) && 'gt' in v) return row[k] > v.gt;
    return row[k] === v;
  });
const pick = (row, select) => (select ? Object.fromEntries(Object.keys(select).map((k) => [k, row[k]])) : row);
const applyData = (row, data) => {
  for (const [k, v] of Object.entries(data)) {
    if (v && typeof v === 'object' && 'increment' in v) row[k] = (row[k] || 0) + v.increment;
    else if (k === 'group' && v?.connect) row.groupId = v.connect.id;
    else row[k] = v instanceof Date ? v : clone(v);
  }
  row.updatedAt = new Date();
};
function model(name, defaults = () => ({})) {
  const rows = tables[name];
  return {
    findUnique: async ({ where, select, include }) => {
      const r = rows.find((x) => matches(x, where));
      if (!r) return null;
      const res = { ...pick(r, select) };
      if (include?.restaurant) res.restaurant = tables.restaurant.find((x) => x.id === r.restaurantId);
      return res;
    },
    findFirst: async ({ where }) => rows.find((x) => matches(x, where)) || null,
    findMany: async ({ where, select } = {}) => rows.filter((x) => matches(x, where)).map((r) => pick(r, select)),
    create: async ({ data }) => {
      const row = { ...defaults(), ...clone(data), createdAt: new Date(), updatedAt: new Date() };
      if (row.id == null && name !== 'sefimLink') row.id = ++seq;
      rows.push(row);
      return row;
    },
    update: async ({ where, data }) => {
      const r = rows.find((x) => matches(x, where));
      if (!r) throw new Error(`${name} yok`);
      applyData(r, data);
      return r;
    },
    updateMany: async ({ where, data }) => {
      const hit = rows.filter((x) => matches(x, where));
      hit.forEach((r) => applyData(r, data));
      return { count: hit.length };
    },
    upsert: async ({ where, create, update }) => {
      const r = rows.find((x) => matches(x, where));
      if (r) {
        applyData(r, update);
        return r;
      }
      const row = { id: ++seq, ...clone(create) };
      rows.push(row);
      return row;
    },
    aggregate: async ({ where }) => {
      const hit = rows.filter((x) => matches(x, where));
      return { _max: { sortOrder: hit.length ? Math.max(...hit.map((x) => x.sortOrder || 0)) : null } };
    },
  };
}
const db = {
  sefimLink: model('sefimLink', () => ({ bridgeNote: null, bridgeVersion: null, settingsVer: 1, tokenHash: null, pairHash: null, snapshot: null, snapshotHash: null, appliedKey: null, lastSeenAt: null })),
  sefimMap: model('sefimMap', () => ({ hiddenBySync: false, sefimGroup: null })),
  group: model('group', () => ({ isActive: true, parentId: null })),
  product: model('product', () => ({ isActive: true, optionGroups: [] })),
  currency: model('currency', () => ({ isActive: true })),
  $transaction: async (fn) => fn(db),
};
tables.currency.push({ id: 1, code: 'TRY', isActive: true });
globalThis.__db = db;

const { sefimAdminRouter, sefimBridgeRouter } = await import(pathToFileURL(out).href);
const app = express();
app.use(express.json({ limit: '10mb' }));
app.use('/api/admin/sefim', sefimAdminRouter);
app.use('/api/sefim', sefimBridgeRouter);
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
const call = async (method, url, body, headers = {}) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const admin = { 'x-user': '1', 'x-restaurant': '1' };

try {
  // restoranın elle eklediği bir ürün ve grup zaten var
  tables.group.push({ id: 1, restaurantId: 1, parentId: null, sortOrder: 1, isActive: true, i18n: { tr: { name: 'İçecekler' }, en: { name: 'Drinks' } } });
  tables.product.push({ id: 2, restaurantId: 1, groupId: 1, price: 35, sortOrder: 1, isActive: true, optionGroups: [], i18n: { tr: { name: 'Ayran', description: 'Ev yapımı' }, en: { name: 'Ayran' } }, imageUrl: '/u/ayran.jpg' });

  // 1) panel kod üretir
  assert.equal((await call('POST', '/api/admin/sefim/pair-code')).status, 401, 'giriş yapmadan kod alınamaz');
  const code = (await call('POST', '/api/admin/sefim/pair-code', null, admin)).body.code;
  assert.match(code, /^[A-Z2-9]{4}-[A-Z2-9]{4}$/);

  // 2) Çırak kodla eşleşir (küçük harf / tiresiz de olur); kod ikinci kez kullanılamaz
  assert.equal((await call('POST', '/api/sefim/pair', { code: 'AAAA-AAAA' })).status, 400);
  const pair = await call('POST', '/api/sefim/pair', { code: code.toLowerCase().replace('-', ''), device: 'KASA-PC' });
  assert.equal(pair.status, 200);
  assert.equal(pair.body.restaurant, 'Test Dürüm');
  const token = pair.body.token;
  assert.equal((await call('POST', '/api/sefim/pair', { code })).status, 400, 'tek kullanımlık');
  const bearer = { Authorization: `Bearer ${token}` };
  assert.equal((await call('POST', '/api/sefim/push', { unchanged: true }, { Authorization: 'Bearer crk_yanlisyanlisyanlisyanlis' })).status, 401);

  // 3) ilk görüntü → menü otomatik dolar
  const snapshot = {
    groups: [{ name: '$Trendyol', count: 5000 }, { name: 'İÇECEKLER', count: 2 }, { name: 'DÜRÜMLER', count: 1 }],
    templates: [{ id: 1, name: 'PAKET' }],
    scope: null,
    products: [
      { id: 41, name: 'AYRAN', group: 'İÇECEKLER', price: 40, tpl: [{ t: 1, c1: 0, c2: 0, p: 45 }] },
      { id: 42, name: 'KOLA', group: 'İÇECEKLER', price: 60 },
      { id: 1021, name: 'TAVUK DÜRÜM', group: 'DÜRÜMLER', price: 0, choices: [{ id: 1, name: '80 GR', price: 275 }, { id: 2, name: '100 GR', price: 315 }] },
    ],
  };
  let push = await call('POST', '/api/sefim/push', { snapshot }, bearer);
  assert.equal(push.status, 200);
  assert.deepEqual(push.body.applied && [push.body.applied.create, push.body.applied.link, push.body.applied.price, push.body.applied.groups], [2, 1, 1, 1]);
  assert.equal(push.body.config.intervalSec, 60);
  const ayran = tables.product.find((p) => p.id === 2);
  assert.equal(ayran.price, 40, 'elle eklenen ayran eşleşti, fiyatı güncellendi');
  assert.equal(ayran.i18n.tr.description, 'Ev yapımı', 'açıklama korunur');
  assert.equal(ayran.imageUrl, '/u/ayran.jpg', 'fotoğraf korunur');
  assert.equal(tables.product.filter((p) => p.i18n.tr.name === 'Ayran').length, 1, 'kopya açılmaz');
  const durum = tables.product.find((p) => p.i18n.tr.name === 'Tavuk Dürüm');
  assert.equal(durum.price, 275);
  assert.equal(durum.optionGroups[0].name, 'Porsiyon');
  const durumGroup = tables.group.find((g) => g.id === durum.groupId);
  assert.equal(durumGroup.i18n.tr.name, 'Dürümler', 'yeni grup düzgün adla açılır');
  assert.equal(tables.product.find((p) => p.i18n.tr.name === 'Kola').groupId, 1, 'var olan İçecekler grubu kullanılır');
  assert.ok(!tables.product.some((p) => /trendyol/i.test(p.i18n.tr.name)));

  // 4) değişmedi sinyali: hiçbir şey yapılmaz
  const hash = push.body.hash;
  push = await call('POST', '/api/sefim/push', { unchanged: true, hash }, bearer);
  assert.equal(push.body.applied, null);

  // 5) Şefim'de fiyat değişti + kola silindi
  const snap2 = { ...snapshot, products: [{ ...snapshot.products[0], price: 50 }, snapshot.products[2]] };
  push = await call('POST', '/api/sefim/push', { snapshot: snap2 }, bearer);
  assert.equal(push.body.applied.price, 1);
  assert.equal(push.body.applied.hide, 1);
  assert.equal(ayran.price, 50);
  const kola = tables.product.find((p) => p.i18n.tr.name === 'Kola');
  assert.equal(kola.isActive, false, 'silinen ürün gizlenir');

  // 6) panel: onaylı moda geç, PAKET fiyatını seç → otomatik uygulanmaz, önizlemede bekler
  let state = (await call('PUT', '/api/admin/sefim/settings', { ...(await call('GET', '/api/admin/sefim', null, admin)).body.settings, autoApply: false, price: 't:1' }, admin)).body;
  assert.equal(state.linked, true);
  assert.equal(state.online, true);
  assert.equal(state.device, 'KASA-PC');
  assert.deepEqual(state.groups.map((g) => [g.name, g.system, g.on]), [['$Trendyol', true, false], ['İÇECEKLER', false, true], ['DÜRÜMLER', false, true]]);
  assert.equal(state.preview.summary.price, 1, 'Ayran PAKET fiyatına geçecek');
  push = await call('POST', '/api/sefim/push', { unchanged: true, hash: push.body.hash }, bearer);
  assert.equal(push.body.applied, null, 'onaylı modda kendiliğinden uygulanmaz');
  assert.equal(ayran.price, 50);
  const prev = (await call('GET', '/api/admin/sefim/preview', null, admin)).body;
  assert.deepEqual(prev.ops.map((o) => [o.k, o.name, o.oldPrice, o.price]), [['update', 'Ayran', 50, 45]]);
  const applied = await call('POST', '/api/admin/sefim/apply', null, admin);
  assert.equal(applied.status, 200);
  assert.equal(ayran.price, 45);
  assert.equal(applied.body.state.preview.pending, false);
  assert.ok(applied.body.state.history.length >= 3);

  // 6b) yanlış özetle "değişmedi" → sunucu tam görüntü ister, menüye dokunmaz
  const before = JSON.stringify(tables.product);
  push = await call('POST', '/api/sefim/push', { unchanged: true, hash: 'baska' }, bearer);
  assert.equal(push.body.resend, true);
  push = await call('POST', '/api/sefim/push', {}, bearer);
  assert.equal(push.body.resend, true, 'görüntüsüz istek boş görüntü olarak kaydedilmez');
  assert.equal(JSON.stringify(tables.product), before);
  // 6c) Çırak Şefim'i okuyamadı → panelde görünür, menüye dokunulmaz
  push = await call('POST', '/api/sefim/push', { problem: 'Şefim veritabanına bağlanılamadı', version: '1.0.0' }, bearer);
  assert.equal(push.status, 200);
  state = (await call('GET', '/api/admin/sefim', null, admin)).body;
  assert.equal(state.bridgeNote, 'Şefim veritabanına bağlanılamadı');
  assert.equal(state.bridgeVersion, '1.0.0');
  assert.equal(JSON.stringify(tables.product), before);
  await call('POST', '/api/sefim/push', { snapshot: snap2, version: '1.0.0' }, bearer);
  assert.equal((await call('GET', '/api/admin/sefim', null, admin)).body.bridgeNote, null, 'sorun geçince not silinir');

  // 7) bağlantıyı kes → eski anahtar çalışmaz
  state = (await call('DELETE', '/api/admin/sefim', null, admin)).body;
  assert.equal(state.linked, false);
  assert.equal((await call('POST', '/api/sefim/push', { unchanged: true, hash }, bearer)).status, 401);
  console.log('sefim-link testleri geçti');
} finally {
  server.close();
}

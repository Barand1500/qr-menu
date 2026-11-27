import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.garson-check/sefim-sync.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/sefim-sync.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const s = await import(pathToFileURL(out).href);

// ── isimler
assert.equal(s.tidyName('KLASİK DÜRÜMLER'), 'Klasik Dürümler');
assert.equal(s.tidyName('İÇECEKLER'), 'İçecekler');
assert.equal(s.tidyName('ET VE TAVUK MENÜ'), 'Et ve Tavuk Menü');
assert.equal(s.tidyName('80 GR'), '80 gr');
assert.equal(s.tidyName('ŞEFTALİ'), 'Şeftali');
assert.equal(s.tidyName('KARIŞIK PIZZA'), 'Karışık Pizza');
assert.equal(s.tidyName('ICE TEA'), 'Ice Tea');
assert.equal(s.tidyName('Patates Kızartması (100 gr.)'), 'Patates Kızartması (100 gr.)'); // küçük harf varsa dokunma
assert.equal(s.tidyName('Mega Tavuk Döner Dürüm - 120 gr.'), 'Mega Tavuk Döner Dürüm - 120 gr.');
assert.equal(s.isSystemGroup('$Trendyol'), true);
assert.equal(s.isSystemGroup('[R]Rezervasyon'), true);
assert.equal(s.isSystemGroup('TATLI'), false);

// ── görüntü doğrulama
const snap = s.parseSnapshot({
  groups: [
    { name: '$Trendyol', count: 24673 },
    { name: 'KLASİK DÜRÜMLER', count: 2 },
    { name: 'İÇECEKLER', count: 2 },
    { name: 'PIZZALAR', count: 1 },
  ],
  templates: [{ id: 1, name: 'PAKET' }],
  products: [
    { id: 1021, name: 'TAVUK DÖNER', group: 'KLASİK DÜRÜMLER', price: 0, choices: [
      { id: 1002, name: '80 GR', price: 275, order: 1 },
      { id: 1003, name: '100 GR', price: 315, order: 2 },
    ], tpl: [{ t: 1, c1: 1002, c2: 0, p: 300 }, { t: 1, c1: 1003, c2: 0, p: 340 }] },
    { id: 26, name: 'ET DÜRÜM', group: 'KLASİK DÜRÜMLER', price: 390, tpl: [{ t: 1, c1: 0, c2: 0, p: 420 }] },
    { id: 40, name: 'SOĞUK ÇAY', group: 'İÇECEKLER', price: 60, choices: [
      { id: 1, name: 'ŞEFTALİ', price: 0 },
      { id: 2, name: 'LİMON', price: 0 },
    ] },
    { id: 41, name: 'AYRAN', group: 'İÇECEKLER', price: 40 },
    { id: 76857, name: 'PİZZA', group: 'PIZZALAR', price: 0, choices: [
      { id: 1044, name: 'BOY', price: 0, subs: [{ id: 1, name: 'KÜÇÜK', price: 200, order: 1 }, { id: 2, name: 'BÜYÜK', price: 400, order: 3 }, { id: 3, name: 'ORTA', price: 300, order: 2 }] },
      { id: 1045, name: 'ÇEŞİT', price: 0, subs: [{ id: 4, name: 'KARIŞIK', price: 0 }, { id: 5, name: 'VEGAN', price: 0 }] },
    ], options: [{ id: 'sos', name: 'SOSLAR', min: 0, max: 3, items: [{ id: 'm', name: 'MAYONEZ', price: 10 }] }] },
    { id: 99, name: 'Trendyol kopyası', group: '$Trendyol', price: 1 },
    { id: 41, name: 'çift satır', group: 'İÇECEKLER', price: 1 }, // aynı id tekrar → atlanır
    { id: 0, name: 'bozuk', group: 'X' },
  ],
});
assert.equal(snap.products.length, 6);

// ── ürün şekli: porsiyonlar
const doner = s.productShape(snap.products[0], { price: 'base', tidyNames: true });
assert.equal(doner.price, 275, 'ana fiyat 0 ise en düşük porsiyon');
assert.equal(doner.optionGroups[0].name, 'Porsiyon');
assert.equal(doner.optionGroups[0].pricing, 'replace');
assert.deepEqual(doner.optionGroups[0].options.map((o) => [o.name, o.price]), [['80 gr', 275], ['100 gr', 315]]);
const paket = s.productShape(snap.products[0], { price: 't:1', tidyNames: true });
assert.deepEqual(paket.optionGroups[0].options.map((o) => o.price), [300, 340], 'PAKET şablon fiyatı');
assert.equal(s.productShape(snap.products[1], { price: 't:1', tidyNames: true }).price, 420);
assert.equal(s.productShape(snap.products[1], { price: 't:9', tidyNames: true }).price, 390, 'şablonda yoksa ana fiyat');
const cay = s.productShape(snap.products[2], { price: 'base', tidyNames: true });
assert.equal(cay.optionGroups[0].name, 'Çeşit');
assert.equal(cay.optionGroups[0].pricing, 'add', 'fiyatsız çeşit fiyatı değiştirmez');
assert.equal(cay.price, 60);
const pizza = s.productShape(snap.products[4], { price: 'base', tidyNames: true });
assert.deepEqual(pizza.optionGroups.map((g) => [g.name, g.type, g.pricing]), [['Boy', 'single', 'replace'], ['Çeşit', 'single', 'add'], ['Soslar', 'choice', 'add']]);
assert.deepEqual(pizza.optionGroups[0].options.map((o) => o.name), ['Küçük', 'Orta', 'Büyük'], 'sıra korunur');
assert.equal(pizza.price, 200);

// ── plan: boş menü → sistem grupları hariç her şey eklenir
const settings = s.normalizeSettings({});
let plan = s.planSync({ snapshot: snap, settings, groups: [], products: [], maps: [] });
assert.equal(plan.summary.create, 5, '$Trendyol ürünü eklenmez');
assert.equal(plan.summary.groups, 3);
assert.deepEqual(plan.ops.filter((o) => o.k === 'group').map((o) => o.name), ['Klasik Dürümler', 'İçecekler', 'Pizzalar']);

// ── elle eklenmiş aynı adlı ürün kopyalanmaz, eşleşir ve fiyatı güncellenir
const own = { id: 500, groupId: 7, name: 'Ayran', price: 35, isActive: true, optionGroups: [] };
plan = s.planSync({ snapshot: snap, settings, groups: [{ id: 7, name: 'İçecekler' }], products: [own], maps: [] });
assert.ok(plan.ops.some((o) => o.k === 'link' && o.localId === 500));
assert.ok(plan.ops.some((o) => o.k === 'linkGroup' && o.localId === 7), 'aynı adlı grup kullanılır');
const upd = plan.ops.find((o) => o.k === 'update' && o.localId === 500);
assert.equal(upd.set.price, 40);
assert.equal(upd.from.price, 35);
assert.equal(plan.summary.create, 4);
// birleştirme kapalıysa ayrı eklenir
plan = s.planSync({ snapshot: snap, settings: { ...settings, matchByName: false }, groups: [{ id: 7, name: 'İçecekler' }], products: [own], maps: [] });
assert.equal(plan.summary.create, 5);

// ── eşi olan ürün: ad/fiyat değişimi, gizleme, geri gelme
const groups = [{ id: 1, name: 'Klasik Dürümler' }, { id: 2, name: 'İçecekler' }];
const gm = [
  { kind: 'group', sefimKey: 'KLASİK DÜRÜMLER', localId: 1, sefimGroup: null, hiddenBySync: false },
  { kind: 'group', sefimKey: 'İÇECEKLER', localId: 2, sefimGroup: null, hiddenBySync: false },
];
const local = [
  { id: 10, groupId: 1, name: 'Et Dürüm', price: 390, isActive: true, optionGroups: [] },
  { id: 11, groupId: 2, name: 'Ayran (eski ad)', price: 40, isActive: true, optionGroups: [] },
  { id: 12, groupId: 2, name: 'Kola', price: 50, isActive: true, optionGroups: [] }, // Şefim'den kalkmış
  { id: 13, groupId: 2, name: 'Elle eklenen', price: 5, isActive: true, optionGroups: [] }, // eşi yok → dokunulmaz
];
const pm = [
  { kind: 'product', sefimKey: '26', localId: 10, sefimGroup: 'KLASİK DÜRÜMLER', hiddenBySync: false },
  { kind: 'product', sefimKey: '41', localId: 11, sefimGroup: 'İÇECEKLER', hiddenBySync: false },
  { kind: 'product', sefimKey: '77', localId: 12, sefimGroup: 'İÇECEKLER', hiddenBySync: false },
];
plan = s.planSync({ snapshot: snap, settings, groups, products: local, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.localId === 10), 'değişmeyen ürüne dokunulmaz');
assert.equal(plan.ops.find((o) => o.localId === 11).set.name, 'Ayran');
assert.ok(plan.ops.some((o) => o.k === 'hide' && o.localId === 12));
assert.ok(!plan.ops.some((o) => o.localId === 13), 'elle eklenen ürüne dokunulmaz');
// "Dokunma" seçiliyse gizlenmez
plan = s.planSync({ snapshot: snap, settings: { ...settings, removed: 'keep' }, groups, products: local, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.k === 'hide'));
// grup seçimden çıkarılınca o grubun ürünleri gizlenmez
plan = s.planSync({ snapshot: snap, settings: { ...settings, groups: ['KLASİK DÜRÜMLER'] }, groups, products: local, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.k === 'hide'));
// eşitleme gizlediyse ve ürün geri geldiyse açılır
const hidden = local.map((p) => (p.id === 11 ? { ...p, isActive: false } : p));
const hm = pm.map((m) => (m.localId === 11 ? { ...m, hiddenBySync: true } : m));
plan = s.planSync({ snapshot: snap, settings, groups, products: hidden, maps: [...gm, ...hm] });
assert.ok(plan.ops.some((o) => o.k === 'show' && o.localId === 11));
// restoran elle gizlediyse açılmaz
plan = s.planSync({ snapshot: snap, settings, groups, products: hidden, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.k === 'show'));

// ── güvenlik: ürünlerin çoğu birden kaybolursa gizleme yapılmaz
const many = Array.from({ length: 10 }, (_, i) => ({ id: 100 + i, groupId: 2, name: `Ürün ${i}`, price: 1, isActive: true, optionGroups: [] }));
const manyMaps = many.map((p) => ({ kind: 'product', sefimKey: String(p.id + 1000), localId: p.id, sefimGroup: 'İÇECEKLER', hiddenBySync: false }));
plan = s.planSync({ snapshot: snap, settings, groups, products: many, maps: [...gm, ...manyMaps] });
assert.ok(!plan.ops.some((o) => o.k === 'hide'));
assert.ok(plan.warnings.some((w) => w.includes('gizlenmedi')));

// ── sadece yenileri ekle: var olanlara dokunmaz
plan = s.planSync({ snapshot: snap, settings: { ...settings, mode: 'addOnly' }, groups, products: local, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.k === 'update' || o.k === 'hide'));
assert.ok(plan.ops.some((o) => o.k === 'create'));

// ── sadece fiyatları güncelle: yeni ürün eklemez, adı değiştirmez
const cheap = local.map((p) => (p.id === 10 ? { ...p, price: 1 } : p));
plan = s.planSync({ snapshot: snap, settings: { ...settings, mode: 'priceOnly' }, groups, products: cheap, maps: [...gm, ...pm] });
assert.ok(!plan.ops.some((o) => o.k === 'create' || o.k === 'group'));
assert.equal(plan.ops.find((o) => o.localId === 10).set.price, 390);
assert.equal(plan.ops.find((o) => o.localId === 11), undefined, 'ad değişikliği yapılmaz');

// ── yeni ürünler gizli eklensin
plan = s.planSync({ snapshot: snap, settings: { ...settings, newVisible: false }, groups: [], products: [], maps: [] });
assert.ok(plan.ops.filter((o) => o.k === 'create').every((o) => o.active === false));

// ── restoranın kendi seçenek grubu ve stok bilgisi korunur
const ownGroup = { id: 'grp_x', name: 'Ekstra', type: 'multi', pricing: 'add', required: false, sortOrder: 0, maxTotalQty: 0, options: [] };
const oldSefim = { ...doner.optionGroups[0], options: doner.optionGroups[0].options.map((o) => ({ ...o, stockQty: 0, price: 1 })) };
const merged = s.mergeOptionGroups([oldSefim, ownGroup], doner.optionGroups);
assert.deepEqual(merged.map((g) => g.id), [doner.optionGroups[0].id, 'grp_x']);
assert.equal(merged[0].options[0].stockQty, 0, 'tükendi bilgisi korunur');
assert.equal(merged[0].options[0].price, 275, 'fiyat Şefim\'den gelir');

// ── ayar doğrulama
const bad = s.normalizeSettings({ mode: 'x', price: 'drop table', groups: ['A', 'A', ''], fields: { name: false } });
assert.equal(bad.mode, 'sync');
assert.equal(bad.price, 'base');
assert.deepEqual(bad.groups, ['A']);
assert.equal(bad.fields.name, false);
assert.equal(bad.fields.price, true);
console.log('sefim-sync testleri geçti');

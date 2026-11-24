import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.translations-db-check');

// Bellek içi sahte veritabanı: dil temizliği ve çevrilebilir metin toplama gerçek koda karşı denenir
const stubPrisma = {
  name: 'stub-prisma',
  setup(b) {
    b.onResolve({ filter: /prisma\.js$/ }, () => ({ path: 'stub', namespace: 'stub' }));
    b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const prisma = globalThis.__db;', loader: 'js' }));
  },
};
for (const [name, entry] of [['cleanup', 'language-cleanup.ts'], ['trans', 'translatable.ts'], ['dict', 'i18n-dict.ts']]) {
  await build({ entryPoints: [path.join(root, 'backend/src/lib', entry)], outfile: path.join(out, name + '.mjs'), bundle: true, platform: 'node', format: 'esm', plugins: [stubPrisma] });
}

const table = (rows) => ({
  rows,
  findMany: async ({ where = {} } = {}) => rows.filter((r) => Object.entries(where).every(([k, v]) => (typeof v === 'object' && v?.in ? v.in.includes(r[k]) : v === undefined || r[k] === v || (k === 'isDeleted' && r[k] === v)))),
  update: async ({ where, data }) => { Object.assign(rows.find((r) => r.id === where.id), data); },
});
const db = {
  group: table([
    { id: 1, restaurantId: 1, i18n: { tr: { name: 'Çorbalar' }, ru: { name: 'Супы', _reviewed: ['name'] }, en: { name: 'Soups' } } },
    { id: 2, restaurantId: 2, i18n: { tr: { name: 'Tatlı' }, ru: { name: 'Десерт' } } },
  ]),
  product: table([
    { id: 10, restaurantId: 1, i18n: { tr: { name: 'Pide', allergens: 'Gluten' }, ru: { name: 'Пиде', description: 'вкусно', allergens: 'Глютен' } },
      optionGroups: [{ id: 'g1', name: 'Boy', type: 'single', options: [{ id: 'o1', name: 'Büyük', price: 5, isActive: true }, { id: 'o2', name: 'Gizli', price: 0, isActive: false }] }] },
  ]),
  showcaseImage: table([
    { id: 20, restaurantId: 1, isDeleted: false, displayType: 'banner', name: 'Vitrin', i18n: { tr: { title1: 'Hafta sonu' }, ru: { title1: 'Выходные' } } },
    { id: 21, restaurantId: 1, isDeleted: false, displayType: 'story', name: 'Kahvaltı', i18n: {} },
    { id: 22, restaurantId: 1, isDeleted: true, displayType: 'story', name: 'Silinmiş' },
    { id: 23, restaurantId: 2, isDeleted: false, displayType: 'story', name: 'Başka işletme' },
    { id: 24, restaurantId: 1, isDeleted: false, displayType: 'story', name: '   ' },
  ]),
  restaurant: table([{ id: 1, welcomeI18n: { tr: { message: 'Hoş geldiniz' }, ru: { message: 'Добро' } } }]),
  campaign: { findMany: async () => [{ slug: 'yaz', name: 'Yaz kampanyası' }] },
  setting: {
    rows: [
      { id: 1, restaurantId: 1, key: 'sofra_theme_v1', value: JSON.stringify({ brandName: 'X', texts: { tr: { welcomeTitle: 'Merhaba' }, ru: { welcomeTitle: 'Привет' } } }) },
      { id: 2, restaurantId: 1, key: 'i18n_dict_v1', value: JSON.stringify({ 'about:headline': { ru: { t: 'Привет', h: 'x' }, en: { t: 'Hi', h: 'x' } } }) },
      { id: 3, restaurantId: 1, key: 'company_about_page', value: JSON.stringify({ headline: 'Hikâyemiz', body: 'Taş fırın', highlights: ['Taze', '', ''] }) },
      { id: 4, restaurantId: 1, key: 'contact_card', value: JSON.stringify({ enabled: true, tagline: 'Taş fırın', managerName: 'Ali', managerTitle: 'Sahibi', hours: '09-23', address: 'Ana Şube' }) },
      { id: 5, restaurantId: 1, key: 'reviews_config', value: JSON.stringify({ manualEnabled: true, manual: [{ name: 'Ayşe', text: 'Güzel', rating: 5 }] }) },
    ],
    findMany: async ({ where = {} } = {}) => db.setting.rows.filter((r) => (where.restaurantId === undefined || r.restaurantId === where.restaurantId) && (!where.key?.in || where.key.in.includes(r.key))),
    update: async ({ where, data }) => { Object.assign(db.setting.rows.find((r) => r.id === where.id), data); },
  },
};
globalThis.__db = db;
const { purgeLanguage } = await import(pathToFileURL(path.join(out, 'cleanup.mjs')).href);
const trans = await import(pathToFileURL(path.join(out, 'trans.mjs')).href);

// ── çevrilebilir metinler toplanır (yalnızca dolu olanlar, etkin seçenekler)
const sources = await trans.collectDictSources(1);
const keys = sources.map((s) => s.key);
assert.ok(keys.includes('about:headline') && keys.includes('about:body') && keys.includes('about:highlight:0'));
assert.ok(!keys.includes('about:highlight:1'), 'boş vurgu atlanır');
assert.ok(keys.includes('contact:tagline') && keys.includes('contact:managerTitle') && keys.includes('contact:hours') && keys.includes('contact:address'));
assert.ok(keys.some((k) => k.startsWith('review:')));
assert.ok(keys.includes('option:10:g1') && keys.includes('option:10:g1:o1'));
assert.ok(!keys.includes('option:10:g1:o2'), 'pasif seçenek çevrilmez');
assert.ok(keys.includes('campaign:yaz'));

// Story names (including rows with no i18n titles) use the same source/hash in bulk translation and menu.
const storySources = sources.filter((s) => s.category === 'stories');
assert.deepEqual(storySources.map((s) => s.key), ['story:21:name']);
assert.equal(storySources[0].sourceText, 'Kahvaltı');
const d = await import(pathToFileURL(path.join(out, 'dict.mjs')).href);
const translated = d.dictSet({}, trans.storyNameKey(21), 'en', 'Breakfast', 'Kahvaltı');
assert.equal(trans.translateStoryName(21, 'Kahvaltı', translated, 'en'), 'Breakfast');
assert.equal(trans.translateStoryName(21, 'Kahvaltı', translated, 'tr'), 'Kahvaltı');
assert.equal(trans.translateStoryName(21, ' Kahvaltı ', translated, 'en'), 'Breakfast');
assert.equal(trans.translateStoryName(21, 'Kahvaltı', translated, 'de'), 'Kahvaltı');
assert.equal(trans.translateStoryName(21, 'Yeni kahvaltı', translated, 'en'), 'Yeni kahvaltı');
assert.equal(trans.translateStoryName(21, 'Kahvaltı', d.dictStripLang(translated, 'en'), 'en'), 'Kahvaltı');

// ── dil silme: ru her yerden gider (tüm restoranlar), diğer diller ve Türkçe kalır
const result = await purgeLanguage('ru');
assert.equal(db.group.rows[0].i18n.ru, undefined);
assert.equal(db.group.rows[1].i18n.ru, undefined, 'başka restoranın verisi de temizlenir');
assert.equal(db.group.rows[0].i18n.en.name, 'Soups');
assert.equal(db.group.rows[0].i18n.tr.name, 'Çorbalar');
assert.equal(db.product.rows[0].i18n.ru, undefined);
assert.equal(db.showcaseImage.rows[0].i18n.ru, undefined);
assert.equal(db.restaurant.rows[0].welcomeI18n.ru, undefined);
const sofra = JSON.parse(db.setting.rows[0].value);
assert.equal(sofra.texts.ru, undefined);
assert.equal(sofra.texts.tr.welcomeTitle, 'Merhaba');
assert.equal(sofra.brandName, 'X');
const dict = JSON.parse(db.setting.rows[1].value);
assert.equal(dict['about:headline'].ru, undefined);
assert.equal(dict['about:headline'].en.t, 'Hi');
assert.equal(result.groups, 2);

// ── Türkçe asla silinmez
const before = JSON.stringify(db.group.rows);
await purgeLanguage('tr');
assert.equal(JSON.stringify(db.group.rows), before);

// ── yeni dil eklenirken artık temizliği alerjen metnini korur; yalnızca o restoran temizlenir
db.product.rows[0].i18n.de = { name: 'Fladenbrot', allergens: 'Gluten DE' };
db.group.rows[0].i18n.de = { name: 'Suppen' };
db.group.rows[1].i18n.de = { name: 'Nachtisch' };
await purgeLanguage('de', { restaurantId: 1, keepAllergens: true });
assert.deepEqual(db.product.rows[0].i18n.de, { allergens: 'Gluten DE' });
assert.equal(db.group.rows[0].i18n.de, undefined);
assert.equal(db.group.rows[1].i18n.de.name, 'Nachtisch', 'başka restoran etkilenmez');
console.log('PASS: dil silme/ekleme temizliği ve çevrilebilir metin toplama');

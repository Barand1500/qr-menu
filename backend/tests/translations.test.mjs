import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.translations-check');
await build({ entryPoints: [path.join(root, 'backend/src/lib/i18n-dict.ts')], outfile: path.join(out, 'dict.mjs'), bundle: true, platform: 'node', format: 'esm' });
const d = await import(pathToFileURL(path.join(out, 'dict.mjs')).href);

// özet: aynı metin aynı, farklı metin farklı
assert.equal(d.hashText('Merhaba'), d.hashText('Merhaba'));
assert.notEqual(d.hashText('Merhaba'), d.hashText('Merhabaa'));

// sözlük: çeviri kaynak değişmedikçe geçerli, değişince bayat
let dict = d.dictSet({}, 'about:headline', 'ru', ' Привет ', 'Merhaba');
assert.equal(d.dictGet(dict, 'about:headline', 'ru', 'Merhaba'), 'Привет');
assert.equal(d.dictGet(dict, 'about:headline', 'ru', 'Merhaba!'), ''); // kaynak değişti → bayat
assert.equal(d.dictText(dict, 'about:headline', 'ru', 'Merhaba!'), 'Merhaba!'); // gösterimde kaynağa düşer
assert.equal(d.dictText(dict, 'about:headline', 'ru', 'Merhaba'), 'Привет');
assert.equal(d.dictText(dict, 'about:headline', 'tr', 'Merhaba'), 'Merhaba');
assert.equal(d.dictText(dict, 'about:headline', 'en', 'Merhaba'), 'Merhaba'); // başka dilde çeviri yok

// kayıt ve okuma turu; bozuk veri güvenle yok sayılır
dict = d.dictSet(dict, 'about:headline', 'en', 'Hello', 'Merhaba');
assert.deepEqual(d.parseDict(d.serializeDict(dict)), dict);
assert.deepEqual(d.parseDict('{bozuk'), {});
assert.deepEqual(d.parseDict(JSON.stringify({ x: { 'RU!': { t: 'a', h: 'b' }, ru: { t: 1 } } })), {});

// dil silinince sözlükten çıkar; diğer diller kalır; boş anahtar temizlenir
const stripped = d.dictStripLang(dict, 'ru');
assert.equal(stripped['about:headline'].ru, undefined);
assert.equal(stripped['about:headline'].en.t, 'Hello');
assert.deepEqual(d.dictStripLang({ k: { ru: { t: 'a', h: 'b' } } }, 'ru'), {});
assert.equal(d.dictStripLang(dict, 'de'), dict); // değişiklik yoksa aynı nesne

// i18n haritasından dil çıkarma (grup/ürün/hikâye)
const group = { tr: { name: 'Çorba' }, ru: { name: 'Суп', _reviewed: ['name'] } };
assert.deepEqual(d.stripLangFromMap(group, 'ru'), { tr: { name: 'Çorba' } });
assert.equal(d.stripLangFromMap(group, 'de'), null);
assert.equal(d.stripLangFromMap(null, 'ru'), null);
const product = { tr: { name: 'Pide', allergens: 'Gluten' }, ru: { name: 'Пиде', description: 'x', allergens: 'Глютен' } };
assert.deepEqual(d.stripLangFromMap(product, 'ru', ['allergens']), { tr: product.tr, ru: { allergens: 'Глютен' } }); // alerjen korunur
assert.deepEqual(d.stripLangFromMap(product, 'ru'), { tr: product.tr }); // tamamen silinir

// yorum anahtarı içerikle değişir
assert.equal(d.reviewKey('Ali', 'Güzel'), d.reviewKey('Ali', 'Güzel'));
assert.notEqual(d.reviewKey('Ali', 'Güzel'), d.reviewKey('Ali', 'Çok güzel'));
console.log('PASS: çeviri sözlüğü, bayat çeviri, dil temizliği');

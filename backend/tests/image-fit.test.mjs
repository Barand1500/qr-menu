import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.image-fit-check/lib.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/image-fit.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const { parseImageFit, nextImageFit, DEFAULT_IMAGE_FIT } = await import(pathToFileURL(outfile).href);

// Kayıt yok / bozuk: kapalı varsayılan (tema değişmez)
assert.deepEqual(parseImageFit(undefined), DEFAULT_IMAGE_FIT);
assert.equal(parseImageFit('{bozuk').enabled, false);
assert.equal(parseImageFit(null).mode, 'cover');

// Geçersiz değerler güvenli varsayılana döner, sayılar sınırlanır
const messy = parseImageFit({ enabled: true, mode: 'stretch', focus: 'x', fill: 'rainbow', color: 'red', padding: 99, scope: 'zzz', targets: { groups: false } });
assert.equal(messy.enabled, true);
assert.equal(messy.mode, 'cover');
assert.equal(messy.focus, 'center');
assert.equal(messy.fill, 'theme');
assert.equal(messy.color, '#ffffff');
assert.equal(messy.padding, 16);
assert.equal(messy.scope, 'all');
assert.deepEqual(messy.targets, { products: true, groups: false, showcase: true });
assert.equal(parseImageFit({ padding: -5 }).padding, 0);

// "Yalnızca yeniler": tarih ilk seçimde işaretlenir, sonraki kayıtlarda kaymaz; "hepsi"nde sıfırlanır
const t1 = 1_700_000_000_000;
const first = nextImageFit({ enabled: true, scope: 'new' }, DEFAULT_IMAGE_FIT, t1);
assert.equal(first.appliesFrom, t1);
const again = nextImageFit({ enabled: true, scope: 'new', mode: 'contain', appliesFrom: 5 }, first, t1 + 9999);
assert.equal(again.appliesFrom, t1);
assert.equal(nextImageFit({ enabled: true, scope: 'all' }, again, t1 + 1).appliesFrom, 0);
console.log('PASS: image-fit ayarı: varsayılan kapalı, güvenli ayrıştırma, sınırlar, "yalnızca yeniler" tarihi.');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.price-series-check/lib.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/price-series.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const { buildSeries, summarizeProducts, sortSummaries } = await import(pathToFileURL(outfile).href);

const row = (productId, changeId, day, oldPrice, newPrice, kind = 'bulk', name = 'Ürün ' + productId) => ({
  productId, productName: name, oldPrice, newPrice, changeId, at: new Date(Date.UTC(2026, 0, day)), kind, summary: 's', userName: 'u',
});

// zaman sırasına dizer; yeni fiyatı bilinmeyen kayıt bir sonrakinin eski fiyatını alır, sonuncusu güncel fiyatı
const series = buildSeries([row(1, 3, 20, 120, null), row(1, 1, 5, 100, 110), row(1, 2, 10, 110, 120)], 150);
assert.deepEqual(series.map((p) => [p.oldPrice, p.newPrice]), [[100, 110], [110, 120], [120, 150]]);
assert.equal(buildSeries([row(1, 1, 1, 50, null)], null)[0].newPrice, 50);

// özet: ilk fiyata göre değişim, değişiklik sayısı, son değişiklik
const rows = [row(1, 1, 5, 100, 110), row(1, 2, 10, 110, 150), row(2, 3, 12, 200, 180), row(3, 4, 1, 10, 10)];
const sums = summarizeProducts(rows, new Map([[1, 150], [2, 180], [3, 10]]));
const by = Object.fromEntries(sums.map((s) => [s.productId, s]));
assert.equal(by[1].changes, 2);
assert.equal(by[1].deltaPct, 50);
assert.equal(by[2].deltaPct, -10);
assert.equal(by[3].deltaPct, 0);

// sıralamalar
assert.deepEqual(sortSummaries(sums, 'rise').map((s) => s.productId), [1, 3, 2]);
assert.deepEqual(sortSummaries(sums, 'fall').map((s) => s.productId), [2, 3, 1]);
assert.deepEqual(sortSummaries(sums, 'changes')[0].productId, 1);
assert.equal(sortSummaries(sums, 'recent')[0].productId, 2);
console.log('PASS: ürün fiyat serisi: sıralama, çözülen yeni fiyat, özet, sıralamalar.');

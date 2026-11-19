import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.price-history-check/price-history.mjs');
await build({
  entryPoints: [path.join(root, 'src/lib/price-history.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const { describeBulkChange, describeRestore, buildSample } = await import(pathToFileURL(out).href);

const base = { direction: 'up', mode: 'percent', value: 10, rounding: 'off', optionsAction: 'base_only' };

assert.equal(describeBulkChange(base, { kind: 'all' }, '₺'), '%10 zam · Tüm ürünler');
assert.equal(
  describeBulkChange({ ...base, direction: 'down', value: 12.5 }, { kind: 'category', groupName: 'Burgerler' }, '₺'),
  '%12,5 indirim · Burgerler grubu',
);
assert.equal(
  describeBulkChange({ ...base, mode: 'fixed', value: 5 }, { kind: 'selected', count: 7 }, '₺'),
  '5 ₺ zam · 7 seçili ürün',
);
// Para birimi karışıksa simge yazılmaz
assert.equal(describeBulkChange({ ...base, mode: 'fixed', value: 5 }, { kind: 'all' }, null), '5 zam · Tüm ürünler');
assert.equal(
  describeBulkChange({ ...base, optionsAction: 'base_and_options' }, { kind: 'unknown' }, null),
  '%10 zam (seçenekler dahil)',
);
assert.equal(describeRestore('%10 zam · Tüm ürünler'), 'Geri alındı: %10 zam · Tüm ürünler');

const sample = buildSample(
  Array.from({ length: 6 }, (_, i) => ({ name: `Ürün ${i}`, oldPrice: 10, newPrice: 11, symbol: '₺', fazla: 1 })),
);
assert.equal(sample.length, 3);
assert.deepEqual(Object.keys(sample[0]).sort(), ['name', 'newPrice', 'oldPrice', 'symbol']);
console.log('price-history testleri geçti');

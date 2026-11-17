import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'node_modules/.stats-model-test.mjs');
await build({
  entryPoints: [path.join(root, 'src/components/admin/stats/stats-model.ts')],
  outfile: output,
  bundle: true,
  platform: 'node',
  format: 'esm',
});
const { periodRange, normalizeStats } = await import(
  pathToFileURL(output).href
);

// Calendar date boundaries must not depend on the browser/server time zone.
for (const tz of [
  'Europe/Istanbul',
  'America/Los_Angeles',
  'Pacific/Auckland',
]) {
  process.env.TZ = tz;
  assert.deepEqual(periodRange({ year: 2026, month: 1, annual: false }), {
    from: '2026-01-01',
    to: '2026-01-31',
  });
  assert.deepEqual(periodRange({ year: 2024, month: 2, annual: false }), {
    from: '2024-02-01',
    to: '2024-02-29',
  });
  assert.deepEqual(periodRange({ year: 2025, month: 2, annual: false }), {
    from: '2025-02-01',
    to: '2025-02-28',
  });
  assert.deepEqual(periodRange({ year: 2026, month: 12, annual: false }), {
    from: '2026-12-01',
    to: '2026-12-31',
  });
  assert.deepEqual(periodRange({ year: 2026, month: 3, annual: true }), {
    from: '2026-01-01',
    to: '2026-12-31',
  });
}
const rows = normalizeStats([
  { id: 1, name: 'Düşük', count: 2 },
  { id: 2, name: 'Yüksek', count: 50 },
  null,
  { count: NaN },
  { count: Infinity },
  { count: -5 },
  { count: 0 },
  { name: '  ', count: 4 },
]);
assert.deepEqual(
  rows.map((x) => x.count),
  [50, 4, 2],
);
assert.equal(rows[1].name, 'Bilinmiyor');
assert.throws(() => normalizeStats({ items: [] }));
assert.deepEqual(normalizeStats([]), []);
console.log(
  'PASS calendar boundaries in three time zones, leap year/full year, malformed counts and safe ranking',
);

import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
const result = await build({
  entryPoints: [fileURLToPath(new URL('../src/lib/menuSearch.ts', import.meta.url))],
  bundle: true,
  write: false,
  format: 'esm',
  platform: 'node',
});
const { searchMenu } = await import(
  'data:text/javascript;base64,' + Buffer.from(result.outputFiles[0].text).toString('base64')
);
const rows = [
  { name: 'Margherita Pizza', group: 'Pizzalar' },
  { name: 'Acılı Pizza', group: 'Pizzalar' },
  { name: 'Zeen Burger', group: 'Burgerler' },
  { name: 'Izgara Köfte', group: 'Ana Yemekler' },
  { name: 'Salata', group: 'Salatalar' },
];
const find = (q) => searchMenu(rows, q, (p) => [p.name, p.group]);
assert.deepEqual(
  find('piza').map((r) => r.item.name),
  ['Margherita Pizza', 'Acılı Pizza'],
);
assert.equal(find('buger')[0].item.name, 'Zeen Burger');
assert.ok(find('buger')[0].suggestion);
assert.equal(find('bruger')[0].item.name, 'Zeen Burger');
assert.equal(find('zeen buger')[0].item.name, 'Zeen Burger');
assert.equal(find('izgara kofte')[0].item.name, 'Izgara Köfte');
assert.equal(find('pizzalar').length, 2);
assert.equal(find('pizza')[0].suggestion, undefined);
assert.equal(find('saltaa')[0].item.name, 'Salata');
for (const q of ['', '   ', 'xx', 'zzzzzzzz', 'pizza burger']) assert.equal(find(q).length, 0, q);
assert.equal(
  searchMenu(
    [...Array.from({ length: 130 }, () => ({ name: 'Su', group: 'İçecekler' })), rows[2]],
    'buger',
    (p) => [p.name, p.group],
  ).length,
  1,
);
assert.equal(
  searchMenu([rows[0], { name: 'Piza Özel', group: 'Özel' }], 'piza', (p) => [p.name, p.group])
    .length,
  1,
);
console.log(
  'PASS menu spelling: missing/repeated/transposed letters, Turkish normalization, categories, multiple words, exact-first, short/unrelated/empty input and full catalogue',
);

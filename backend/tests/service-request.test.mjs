import assert from 'node:assert/strict';
import { build } from 'esbuild';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const outfile = path.join(root, 'node_modules/.login-check/service-request.mjs');
await build({ entryPoints: [path.join(root, 'src/lib/table-service-request.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const { parseServiceRequest: parse } = await import(pathToFileURL(outfile).href);
assert.deepEqual(parse('waiter', undefined, '  Soğansız  ', { items: [] }), { requestType: 'waiter', noteText: 'Soğansız' });
assert.equal(parse('hookah', undefined, undefined).requestType, 'hookah');
assert.deepEqual(parse('valet', '  34 abc   123  ', 'untrusted note'), { requestType: 'valet', noteText: 'Plaka: 34 ABC 123' });
assert.equal(parse('valet', 'D-AB 1234', null).noteText, 'Plaka: D-AB 1234');
assert.equal(parse('waiter', undefined, 'x'.repeat(600)).noteText.length, 500);
for (const value of ['', 'A', 'ABCDEF', '<img 123>', '34\nABC\u0000123', '1'.repeat(21), {}, 34123, null]) {
  assert.throws(() => parse('valet', value), /plaka/);
}
for (const kind of ['bill', 'unknown', '', null, {}, ['waiter']]) assert.throws(() => parse(kind), /türü/);
for (const kind of ['hookah', 'valet']) assert.throws(() => parse(kind, '34 ABC 123', undefined, { items: [{ productId: 1 }] }), /sipariş içeremez/);
console.log('PASS service validation: accepted types, domestic/international plate, server normalization, invalid plate/type rejection, waiter order compatibility, non-waiter order rejection');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.service-items-check/table-service.mjs');
await build({
  entryPoints: [path.join(root, 'src/lib/table-service.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
  // Veritabanına dokunmayan saf fonksiyonlar test edilir
  plugins: [{ name: 'stub-prisma', setup: (b) => b.onResolve({ filter: /prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'stub' })) }, { name: 'stub-load', setup: (b) => b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: 'export const prisma = {};', loader: 'js' })) }],
});
const { resolveServiceItems, parseServiceItemsInput } = await import(pathToFileURL(out).href);
const kinds = (items) => items.map((i) => `${i.kind}:${i.enabled ? 1 : 0}`).join(',');

// Kayıt yokken eski tek anahtar tüm servisleri belirler
assert.equal(kinds(resolveServiceItems(undefined, undefined)), 'waiter:1,bill:1,hookah:1,valet:1');
assert.equal(kinds(resolveServiceItems('false', undefined)), 'waiter:0,bill:0,hookah:0,valet:0');
// Kayıtlı sıra korunur; eksik servis sona açık eklenir
assert.equal(
  kinds(resolveServiceItems('false', JSON.stringify([{ kind: 'valet', enabled: true }, { kind: 'waiter', enabled: false }]))),
  'valet:1,waiter:0,bill:1,hookah:1',
);
// Bozuk kayıt varsayılana döner
assert.equal(kinds(resolveServiceItems(undefined, '{bozuk')), 'waiter:1,bill:1,hookah:1,valet:1');

// Panelden gelen liste: dört servis, birer kez, boolean
const ok = [
  { kind: 'bill', enabled: true },
  { kind: 'waiter', enabled: false },
  { kind: 'valet', enabled: true },
  { kind: 'hookah', enabled: true },
];
assert.deepEqual(parseServiceItemsInput(ok), ok);
assert.equal(parseServiceItemsInput(ok.slice(1)), null);
assert.equal(parseServiceItemsInput([...ok.slice(0, 3), { kind: 'bill', enabled: true }]), null);
assert.equal(parseServiceItemsInput([...ok.slice(0, 3), { kind: 'taksi', enabled: true }]), null);
assert.equal(parseServiceItemsInput([...ok.slice(0, 3), { kind: 'hookah', enabled: 'evet' }]), null);
console.log('service-items testleri geçti');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'node_modules/.image-background-check/image-background.mjs');
await build({
  entryPoints: [path.join(root, 'src/lib/image-background.ts')],
  outfile: out,
  bundle: true,
  platform: 'node',
  format: 'esm',
  logLevel: 'error',
});
const { parseImageBackgroundMode, IMAGE_BACKGROUND_MODES } = await import(pathToFileURL(out).href);

assert.deepEqual([...IMAGE_BACKGROUND_MODES], ['ask', 'auto', 'never']);
for (const mode of ['ask', 'auto', 'never']) assert.equal(parseImageBackgroundMode(mode), mode);
// Kayıt yok / bozuk / yabancı değer: henüz seçilmemiş sayılır
for (const bad of [undefined, null, '', 'always', 'ASK', 1, {}, []]) {
  assert.equal(parseImageBackgroundMode(bad), null);
}
console.log('image-background testleri geçti');

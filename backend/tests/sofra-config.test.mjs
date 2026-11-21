import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.sofra-config-check/lib.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/sofra-config.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const { normalizeSofraConfig, parseSofraConfig, SOFRA_DEFAULTS } = await import(pathToFileURL(outfile).href);

// Eski kayıtlarda alan yok: sepet ve varyantlar açık kalır (mevcut menüler değişmez)
assert.equal(normalizeSofraConfig({}).cartEnabled, true);
assert.equal(normalizeSofraConfig({}).variantsEnabled, true);
assert.equal(parseSofraConfig(JSON.stringify({ brandName: 'X' })).cartEnabled, true);
assert.equal(parseSofraConfig('{bozuk').variantsEnabled, true);
assert.equal(SOFRA_DEFAULTS.cartEnabled && SOFRA_DEFAULTS.variantsEnabled, true);
// Yalnızca açıkça false olan kapanır
const off = normalizeSofraConfig({ cartEnabled: false, variantsEnabled: false });
assert.equal(off.cartEnabled, false);
assert.equal(off.variantsEnabled, false);
assert.equal(normalizeSofraConfig({ cartEnabled: 0, variantsEnabled: 'false' }).cartEnabled, true); // yalnızca boolean false sayılır
// Birini kapatmak diğerini etkilemez
const one = normalizeSofraConfig({ cartEnabled: false });
assert.equal(one.cartEnabled, false);
assert.equal(one.variantsEnabled, true);
console.log('PASS: Sofra ayarı: sepet/varyant varsayılan açık, yalnızca false ile kapanır, bağımsız.');

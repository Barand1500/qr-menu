import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.garson-check/presence.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/table-presence.ts')], outfile: out, bundle: true, platform: 'node', format: 'esm', logLevel: 'error' });
const p = await import(pathToFileURL(out).href);

const now = 1_000_000_000_000;
const a = { id: 'visitor-aaaa1', kind: 'category', label: '  Pizza  ', at: now };
const b = { id: 'visitor-bbbb2', kind: 'cart', label: 'gizli sepet içeriği', at: now };

let list = p.updatePresence([], a, true, now);
list = p.updatePresence(list, b, true, now + 1000);
assert.equal(list.length, 2);
// sepet ve menü için etiket saklanmaz (içerik sızmaz); kategori etiketi kırpılır
assert.equal(list.find((v) => v.id === b.id).label, '');
assert.equal(list.find((v) => v.id === a.id).label, 'Pizza');

// aynı müşteri tek kayıt kalır, ekran değişince güncellenir
list = p.updatePresence(list, { ...a, kind: 'cart', label: '' }, true, now + 2000);
assert.equal(list.length, 2);
assert.equal(p.summarizePresence(list, now + 2000).find((s) => s.kind === 'cart').count, 2);

// ayrılan müşteri silinir, süresi dolan kayıt düşer
list = p.updatePresence(list, a, false, now + 3000);
assert.equal(list.length, 1);
assert.equal(p.parsePresence(list, now + p.PRESENCE_TTL_MS + 5000).length, 0);

// bozuk veri güvenli
assert.deepEqual(p.parsePresence('x', now), []);
assert.deepEqual(p.parsePresence([{ id: '../..', kind: 'cart', at: now }], now), []);
// alerji/diyet işaretleri: yalnızca bilinen katalog kimlikleri geçer, serbest metin atılır
let withPrefs = p.updatePresence([], { id: 'visitor-pref01', kind: 'menu', label: '', at: now, prefs: ['a:gluten', 'd:vegan', 'x:evil', '<script>', 'a:gluten'] }, true, now);
withPrefs = p.updatePresence(withPrefs, { id: 'visitor-pref02', kind: 'cart', label: '', at: now, prefs: ['a:dairy'] }, true, now);
assert.deepEqual(p.parsePresence(withPrefs, now).find((v) => v.id === 'visitor-pref01').prefs, ['a:gluten', 'd:vegan']);
assert.deepEqual([...p.presencePrefs(withPrefs, now)].sort(), ['a:dairy', 'a:gluten', 'd:vegan']);
assert.deepEqual(p.presencePrefs(withPrefs, now + p.PRESENCE_TTL_MS + 1), [], 'süre dolunca işaretler de silinir');
console.log('table-presence: tamam');

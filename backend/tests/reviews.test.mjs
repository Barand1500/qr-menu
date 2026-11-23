import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const out = path.join(root, 'backend/node_modules/.reviews-check');
for (const [name, entry] of [['cfg', 'reviews-config.ts'], ['places', 'google-places.ts'], ['pub', 'reviews-public.ts']]) {
  await build({ entryPoints: [path.join(root, 'backend/src/lib', entry)], outfile: path.join(out, name + '.mjs'), bundle: true, platform: 'node', format: 'esm' });
}
const cfg = await import(pathToFileURL(path.join(out, 'cfg.mjs')).href);
const places = await import(pathToFileURL(path.join(out, 'places.mjs')).href);
const pub = await import(pathToFileURL(path.join(out, 'pub.mjs')).href);

// ayar şeması
assert.equal(cfg.parseReviews(null).googleEnabled, false);
assert.equal(cfg.parseReviews('{bozuk').manual.length, 0);
assert.equal(cfg.normalizeReviews({ googleEnabled: true }).googleEnabled, false); // yer yok → açılamaz
const ok = cfg.normalizeReviews({ googleEnabled: true, placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', placeName: ' Zeen  Cafe ' });
assert.equal(ok.googleEnabled, true);
assert.equal(ok.placeName, 'Zeen Cafe');
assert.equal(cfg.normalizeReviews({ placeId: '../../x' }).placeId, '');
const man = cfg.normalizeReviews({ manualEnabled: true, manual: [{ name: 'Ayşe', text: 'Harika', rating: 9 }, { name: '', text: 'x' }, { name: 'B', text: '' }, { name: 'C', text: 'İyi', rating: 'x' }] });
assert.equal(man.manual.length, 2);
assert.equal(man.manual[0].rating, 5);
assert.equal(man.manual[1].rating, 5);
assert.equal(cfg.normalizeReviews({ manual: Array(40).fill({ name: 'A', text: 'B' }) }).manual.length, 12);
assert.equal(cfg.googleWriteReviewUrl('ChIJabc_123-xyz'), 'https://search.google.com/local/writereview?placeid=ChIJabc_123-xyz');
assert.equal(cfg.googleWriteReviewUrl(''), '');
assert.deepEqual(cfg.parseReviews(cfg.serializeReviews(man)), man);

// Google yanıtı ayrıştırma
const parsed = places.parsePlace({
  id: 'ChIJabc', displayName: { text: 'Zeen Cafe' }, formattedAddress: 'Kadıköy', rating: 4.66, userRatingCount: 312,
  googleMapsUri: 'https://maps.google.com/?cid=1',
  reviews: [
    { name: 'places/x/reviews/1', rating: 5, text: { text: 'Harika yer' }, relativePublishTimeDescription: '2 hafta önce', authorAttribution: { displayName: 'Ali', photoUri: 'https://lh3.googleusercontent.com/a/x' } },
    { name: 'r2', rating: 3.6, originalText: { text: 'Idare eder' }, authorAttribution: { displayName: 'Veli', photoUri: 'https://kotu.example/x.jpg' } },
    { name: 'r3', rating: 4, text: { text: '' } },
    { rating: 4 },
  ],
});
assert.equal(parsed.rating, 4.66);
assert.equal(parsed.count, 312);
assert.equal(parsed.reviews.length, 2); // metinsiz yorumlar atılır
assert.equal(parsed.reviews[0].photo.startsWith('https://lh3.googleusercontent.com/'), true);
assert.equal(parsed.reviews[1].photo, ''); // yabancı görsel adresi kabul edilmez
assert.equal(parsed.reviews[1].rating, 4);
assert.equal(places.parsePlace(null).reviews.length, 0);

// Anahtar yokken Google denenmez; elle yorumlar yine gelir
delete process.env.GOOGLE_PLACES_API_KEY;
let calls = 0;
globalThis.fetch = async () => { calls++; throw new Error('çağrılmamalı'); };
const onlyManual = await pub.buildPublicReviews(cfg.normalizeReviews({ googleEnabled: true, placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', manualEnabled: true, manual: [{ name: 'Ali', text: 'Güzel', rating: 4 }] }), 'tr');
assert.equal(calls, 0);
assert.equal(onlyManual.items.length, 1);
assert.equal(onlyManual.rating, null);
assert.equal(await pub.buildPublicReviews(cfg.normalizeReviews({}), 'tr'), null);

// Anahtar varken: karışık sıra, önbellek ve hata davranışı
process.env.GOOGLE_PLACES_API_KEY = 'test-key';
const body = { id: 'ChIJN1t_tDeuEmsRUsoyG83frY4', displayName: { text: 'Z' }, rating: 4.5, userRatingCount: 10, reviews: [
  { name: 'a', rating: 5, text: { text: 'G1' }, authorAttribution: { displayName: 'A' } },
  { name: 'b', rating: 4, text: { text: 'G2' }, authorAttribution: { displayName: 'B' } } ] };
let seen = null;
globalThis.fetch = async (url, init) => { calls++; seen = { url: String(url), headers: init.headers }; return { ok: true, json: async () => body }; };
const c = cfg.normalizeReviews({ googleEnabled: true, placeId: 'ChIJN1t_tDeuEmsRUsoyG83frY4', manualEnabled: true, manual: [{ name: 'M1', text: 'Elle', rating: 5 }] });
const mixed = await pub.buildPublicReviews(c, 'tr');
assert.deepEqual(mixed.items.map((i) => i.source), ['google', 'manual', 'google']);
assert.equal(mixed.rating, 4.5);
assert.ok(mixed.writeUrl.includes('writereview'));
assert.equal(seen.headers['X-Goog-Api-Key'], 'test-key');
assert.ok(seen.headers['X-Goog-FieldMask'].includes('reviews'));
await pub.buildPublicReviews(c, 'tr');
assert.equal(calls, 1, 'ikinci istek önbellekten gelmeli');
// hata: menü bozulmaz, elle yorumlar gelir
// (aynı paketteki önbellek paylaşılmadığı için farklı bir yer kimliğiyle denenir)
globalThis.fetch = async () => ({ ok: false, status: 403, json: async () => ({}) });
const failed = await pub.buildPublicReviews(cfg.normalizeReviews({ googleEnabled: true, placeId: 'ChIJfailfailfail1', manualEnabled: true, manual: [{ name: 'M1', text: 'Elle', rating: 5 }] }), 'tr');
assert.equal(failed.items.length, 1);
assert.equal(failed.rating, null);
console.log('PASS: yorumlar entegrasyonu (şema, Google ayrıştırma, önbellek, hata)');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.contact-card-check/lib.mjs');
await build({ entryPoints: [path.join(root, 'backend/src/lib/contact-card.ts')], outfile, bundle: true, platform: 'node', format: 'esm' });
const m = await import(pathToFileURL(outfile).href);

// boş / bozuk kayıt: kapalı varsayılan
assert.equal(m.parseContactCard(null).enabled, false);
assert.equal(m.parseContactCard('{bozuk').enabled, false);
assert.deepEqual(m.parseContactCard('{bozuk').signature, []);
// yalnızca boolean true açar
assert.equal(m.normalizeContactCard({ enabled: 'true' }).enabled, false);
assert.equal(m.normalizeContactCard({ enabled: true }).enabled, true);
// alan temizliği
const c = m.normalizeContactCard({
  phone: '+90 (532) 111 22 33 abc', email: 'kotu', website: 'ornek.com', mapUrl: 'javascript:alert(1)',
  tone: 'x', managerName: '  Ali   Veli \n', signature: ['M 1 2 L 3 4', 'M 1 2 <script>', 'L 1 2', 5],
});
assert.equal(c.phone, '+90 (532) 111 22 33');
assert.equal(c.email, '');
assert.equal(c.website, 'https://ornek.com/');
assert.equal(c.mapUrl, '');
assert.equal(c.tone, 'ember');
assert.equal(c.managerName, 'Ali Veli');
assert.deepEqual(c.signature, ['M 1 2 L 3 4']); // sahte/bozuk yollar atılır
assert.equal(m.normalizeContactCard({ email: 'a@b.co' }).email, 'a@b.co');
// imza sınırı
assert.equal(m.normalizeContactCard({ signature: Array(30).fill('M 1 1 L 2 2') }).signature.length, 12);
// içerik kontrolü
assert.equal(m.contactCardHasContent(m.CONTACT_CARD_DEFAULTS), false);
assert.equal(m.contactCardHasContent({ ...m.CONTACT_CARD_DEFAULTS, phone: '555' }), true);
// konum ve WhatsApp bağlantıları
assert.equal(m.contactCardMapUrl({ mapUrl: '', address: 'Bahçe Sk. 5' }), 'https://www.google.com/maps/search/?api=1&query=Bah%C3%A7e%20Sk.%205');
assert.equal(m.contactCardMapUrl({ mapUrl: 'https://maps.app.goo.gl/x', address: 'a' }), 'https://maps.app.goo.gl/x');
assert.equal(m.contactCardMapUrl({ mapUrl: '', address: '' }), '');
assert.equal(m.contactCardWhatsappUrl('0532 111 22 33'), 'https://wa.me/905321112233');
assert.equal(m.contactCardWhatsappUrl('+90 532 111 22 33'), 'https://wa.me/905321112233');
assert.equal(m.contactCardWhatsappUrl(''), '');
// kaydet-oku turu değişmez
assert.deepEqual(m.parseContactCard(m.serializeContactCard(c)), c);
console.log('PASS: iletişim kartı şeması');

import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.customer-contact-check/lib.mjs');

// Bellekte çalışan sahte veritabanı
const db = {
  customers: new Map(),
  settings: new Map(),
  mails: [],
  smsUrls: [],
};
globalThis.__contactDb = db;
const sk = (w) => `${w.restaurantId_key.restaurantId}:${w.restaurantId_key.key}`;
globalThis.__contactPrisma = {
  menuCustomer: {
    findUnique: async ({ where }) => {
      if (where.id) return db.customers.get(where.id) ?? null;
      const field = where.phone ? 'phone' : 'email';
      return [...db.customers.values()].find((c) => c[field] === where[field]) ?? null;
    },
    update: async ({ where, data }) => {
      const c = db.customers.get(where.id);
      const clash = [...db.customers.values()].find((o) => o.id !== c.id && ((data.phone && o.phone === data.phone) || (data.email && o.email === data.email)));
      if (clash) throw Object.assign(new Error('dup'), { code: 'P2002' });
      Object.assign(c, data);
      return c;
    },
  },
  restaurant: { findUnique: async ({ where }) => (where.id === 7 ? { name: 'Zeen Cafe' } : null) },
  setting: {
    findUnique: async ({ where }) => db.settings.get(sk(where)) ?? null,
    upsert: async ({ where, update, create }) => {
      const cur = db.settings.get(sk(where));
      const row = cur ? Object.assign(cur, update) : { id: db.settings.size + 1, ...create };
      db.settings.set(sk(where), row);
      return row;
    },
    update: async ({ where, data }) => Object.assign(db.settings.get(sk(where)), data),
    updateMany: async ({ where, data }) => {
      const row = [...db.settings.values()].find((r) => r.id === where.id && r.value === where.value);
      if (!row) return { count: 0 };
      Object.assign(row, data);
      return { count: 1 };
    },
  },
};

await build({
  entryPoints: [path.join(root, 'backend/src/lib/customer-contact.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['jsonwebtoken', 'bcryptjs'],
  plugins: [
    {
      name: 'fakes',
      setup(b) {
        b.onResolve({ filter: /(^|\/)config\.js$/ }, () => ({ path: 'config', namespace: 'fake' }));
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'fake' }));
        b.onResolve({ filter: /^nodemailer$/ }, () => ({ path: 'mail', namespace: 'fake' }));
        b.onLoad({ filter: /.*/, namespace: 'fake' }, (a) => ({
          contents:
            a.path === 'config'
              ? "export const config = { jwtSecret: 'test-secret' };"
              : a.path === 'prisma'
                ? 'export const prisma = globalThis.__contactPrisma;'
                : "export default { createTransport() { return { async sendMail(m) { globalThis.__contactDb.mails.push(m); }, close() {} }; } };",
          loader: 'js',
        }));
      },
    },
  ],
});
const lib = await import(pathToFileURL(outfile).href);

globalThis.fetch = async (url) => {
  db.smsUrls.push(String(url));
  return { ok: true, status: 200, text: async () => '00 99' };
};
const lastCode = () => {
  const sms = db.smsUrls.at(-1);
  if (sms) return new URL(sms).searchParams.get('message').match(/\b(\d{6})\b/)?.[1];
  return db.mails.at(-1)?.text.match(/\b(\d{6})\b/)?.[1];
};
const reset = () => {
  db.customers.clear();
  db.settings.clear();
  db.mails.length = 0;
  db.smsUrls.length = 0;
  db.customers.set(1, { id: 1, phone: '5321234567', email: 'a@ornek.com', fullName: 'A' });
  db.customers.set(2, { id: 2, phone: '5339999999', email: 'b@ornek.com', fullName: 'B' });
  delete process.env.CUSTOMER_SMTP_HOST;
};
const smsOn = () =>
  db.settings.set('7:integration_sms', { id: 90, value: JSON.stringify({ enabled: true, provider: 'netgsm', netgsm: { usercode: 'k', password: 'p', header: 'BASLIK' } }) });
const smtpOn = () =>
  db.settings.set('7:integration_smtp', { id: 91, value: JSON.stringify({ enabled: true, host: 'smtp.ornek.com', port: 587, encryption: 'starttls', user: 'u', password: 'p', fromEmail: 'g@ornek.com' }) });
const req = (field, value, id = 1) => lib.requestContactChange({ customerId: id, restaurantId: 7, field, value });
const ver = (field, value, challengeId, code, id = 1) => lib.verifyContactChange({ customerId: id, restaurantId: 7, field, value, challengeId, code });

// kanal seçimi (saf)
const cust = { phone: '5321234567', email: 'a@ornek.com' };
assert.deepEqual(lib.chooseChannel('phone', { sms: true, email: true }, cust, '5001112233'), { channel: 'sms', to: '5001112233' });
assert.deepEqual(lib.chooseChannel('phone', { sms: false, email: true }, cust, '5001112233'), { channel: 'email', to: 'a@ornek.com' });
assert.deepEqual(lib.chooseChannel('email', { sms: true, email: true }, cust, 'x@y.co'), { channel: 'email', to: 'x@y.co' });
assert.deepEqual(lib.chooseChannel('email', { sms: true, email: false }, cust, 'x@y.co'), { channel: 'sms', to: '5321234567' });
assert.throws(() => lib.chooseChannel('phone', { sms: false, email: false }, cust, '5001112233'), (e) => e.status === 503 && /Maalesef/.test(e.message));
assert.throws(() => lib.chooseChannel('phone', { sms: false, email: true }, { phone: null, email: null }, '5001112233'), (e) => e.status === 422);
assert.equal(lib.maskPhone('5321234567'), '5•• ••• •• 67');
assert.equal(lib.maskEmail('baran@gmail.com'), 'b•••@gmail.com');

// 1) SMS açık: telefon değişikliği SMS ile; yanlış kod, doğru kod, tekrar kullanım
reset();
smsOn();
const r1 = await req('phone', '0500 111 22 33');
assert.equal(r1.channel, 'sms');
assert.ok(db.smsUrls.at(-1).includes('gsmno=905001112233'));
await assert.rejects(ver('phone', '5001112233', r1.challengeId, '000000'), (e) => e.status === 401);
const code1 = lastCode();
await assert.rejects(ver('phone', '5001112244', r1.challengeId, code1), (e) => e.status === 401); // başka numara için geçersiz
const done = await ver('phone', '5001112233', r1.challengeId, code1);
assert.equal(done.phone, '5001112233');
await assert.rejects(ver('phone', '5001112233', r1.challengeId, code1), (e) => e.status === 401); // tek kullanımlık

// 2) SMS yok, e-posta var (sistem hesabı): telefon değişikliği mevcut e-postaya kod
reset();
process.env.CUSTOMER_SMTP_HOST = 'smtp.sistem.test';
process.env.CUSTOMER_SMTP_USER = 'u';
process.env.CUSTOMER_SMTP_PASSWORD = 'p';
process.env.CUSTOMER_MAIL_FROM = 'Sistem <s@ornek.com>';
const r2 = await req('phone', '5001112233');
assert.equal(r2.channel, 'email');
assert.equal(db.mails.at(-1).to, 'a@ornek.com');
assert.equal((await ver('phone', '5001112233', r2.challengeId, lastCode())).phone, '5001112233');

// 3) e-posta değişikliği: e-posta açıksa YENİ adrese, değilse SMS ile mevcut telefona
reset();
smtpOn();
smsOn();
const r3 = await req('email', 'Yeni@Ornek.com');
assert.equal(r3.channel, 'email');
assert.equal(db.mails.at(-1).to, 'yeni@ornek.com');
assert.equal((await ver('email', 'yeni@ornek.com', r3.challengeId, lastCode())).email, 'yeni@ornek.com');
reset();
smsOn();
const r3b = await req('email', 'yeni@ornek.com');
assert.equal(r3b.channel, 'sms');
assert.ok(db.smsUrls.at(-1).includes('gsmno=905321234567'));

// 4) hiçbiri yok: anlaşılır hata
reset();
await assert.rejects(req('phone', '5001112233'), (e) => e.status === 503 && /Maalesef şu an bu işlem yapılamıyor/.test(e.message));
await assert.rejects(req('email', 'x@y.co'), (e) => e.status === 503);

// 5) doğrulamalar: aynı değer, başka hesapta kayıtlı, geçersiz biçim, bekleme süresi, deneme sınırı
reset();
smsOn();
await assert.rejects(req('phone', '5321234567'), (e) => e.status === 400);
await assert.rejects(req('phone', '5339999999'), (e) => e.status === 409);
await assert.rejects(req('phone', '123'), (e) => e.status === 400);
await assert.rejects(req('email', 'bozuk'), (e) => e.status === 400);
const r5 = await req('phone', '5001112233');
await assert.rejects(req('phone', '5001112233'), (e) => e.status === 429 && e.retryAfter > 0);
for (let i = 0; i < 5; i++) await ver('phone', '5001112233', r5.challengeId, '111111').catch(() => {});
await assert.rejects(ver('phone', '5001112233', r5.challengeId, lastCode()), (e) => e.status === 401); // 5 hatadan sonra doğru kod da geçmez
console.log('PASS: müşteri iletişim değişikliği: kanal seçimi, kod doğrulama, tek kullanım, sınırlar, çakışma, kanal yoksa hata.');

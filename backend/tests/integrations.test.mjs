import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { build } from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const outfile = path.join(root, 'backend/node_modules/.integrations-check/lib.mjs');
await build({
  entryPoints: [path.join(root, 'backend/src/lib/integration-send.ts')],
  outfile,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['nodemailer'],
  plugins: [
    {
      name: 'fake-prisma',
      setup(b) {
        b.onResolve({ filter: /(^|\/)config\.js$/ }, () => ({ path: 'config', namespace: 'test' }));
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'test' }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
          contents: args.path === 'config' ? "export const config = { jwtSecret: 'test-secret' };" : 'export const prisma = {};',
          loader: 'js',
        }));
      },
    },
  ],
});
const lib = await import(pathToFileURL(outfile).href);
const {
  // integrations.ts'den dışa aktarılanlar paket içinde olduğu için doğrudan ikinci bir paketle alınır
} = lib;

const out2 = path.join(root, 'backend/node_modules/.integrations-check/core.mjs');
await build({
  entryPoints: [path.join(root, 'backend/src/lib/integrations.ts')],
  outfile: out2,
  bundle: true,
  platform: 'node',
  format: 'esm',
  plugins: [
    {
      name: 'fake-prisma',
      setup(b) {
        b.onResolve({ filter: /(^|\/)config\.js$/ }, () => ({ path: 'config', namespace: 'test' }));
        b.onResolve({ filter: /(^|\/)prisma\.js$/ }, () => ({ path: 'prisma', namespace: 'test' }));
        b.onLoad({ filter: /.*/, namespace: 'test' }, (args) => ({
          contents: args.path === 'config' ? "export const config = { jwtSecret: 'test-secret' };" : 'export const prisma = {};',
          loader: 'js',
        }));
      },
    },
  ],
});
const core = await import(pathToFileURL(out2).href);

// şifreleme: gidiş-dönüş, her seferinde farklı çıktı, bozulursa boş
const box = core.encryptSecret('gizli-şifre');
assert.ok(box.startsWith('enc:v1:') && !box.includes('gizli'));
assert.equal(core.decryptSecret(box), 'gizli-şifre');
assert.notEqual(core.encryptSecret('gizli-şifre'), box);
assert.equal(core.decryptSecret(box.slice(0, -4) + 'AAAA'), '');
assert.equal(core.encryptSecret(''), '');

// SMTP ayrıştırma: sınırlar, geçersizler boşalır
const smtp = core.parseSmtp({ enabled: true, host: 'SMTP.Example.com', port: '70000', encryption: 'x', fromEmail: 'bozuk', fromName: 'Ad "<b>' });
assert.equal(smtp.host, 'smtp.example.com');
assert.equal(smtp.port, 587);
assert.equal(smtp.encryption, 'starttls');
assert.equal(smtp.fromEmail, '');
assert.equal(smtp.fromName, 'Ad b');
assert.equal(core.parseSmtp({ host: '-kötü host' }).host, '');

// SMTP birleştirme: boş şifre eskiyi korur, clearPassword siler; istemci görünümünde şifre yok
const prev = { ...core.DEFAULT_SMTP, host: 'smtp.a.com', user: 'u', password: 'eski', fromEmail: 'a@a.com' };
assert.equal(core.mergeSmtp({ host: 'smtp.a.com', password: '' }, prev).password, 'eski');
assert.equal(core.mergeSmtp({ host: 'smtp.a.com', password: 'yeni' }, prev).password, 'yeni');
assert.equal(core.mergeSmtp({ host: 'smtp.a.com', clearPassword: true }, prev).password, '');
const view = core.smtpForClient(prev);
assert.equal('password' in view, false);
assert.equal(view.passwordSet, true);
assert.equal(core.smtpComplete(prev), true);
assert.equal(core.smtpComplete({ ...prev, password: '' }), false);

// SMS: sağlayıcı alanları, gizliler istemciye dönmez, boş gizli korunur
const sms = core.parseSms({ provider: 'twilio', twilio: { accountSid: 'ACaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', authToken: 't', from: '+1555' }, webhook: { url: 'http://kötü' } });
assert.equal(sms.provider, 'twilio');
assert.equal(sms.webhook.url, '');
assert.equal(core.smsComplete(sms), true);
const prevSms = core.parseSms({ provider: 'netgsm', netgsm: { usercode: 'k', password: 'p', header: 'BASLIK' } });
assert.equal(core.mergeSms({ provider: 'netgsm', netgsm: { usercode: 'k', password: '', header: 'BASLIK' } }, prevSms).netgsm.password, 'p');
assert.equal(JSON.stringify(core.smsForClient(prevSms)).includes('"p"'), false);

// telefon biçimleri
for (const [raw, want] of [['0532 123 45 67', '905321234567'], ['532 123 45 67', '905321234567'], ['+90 532 123 45 67', '905321234567'], ['905321234567', '905321234567'], ['+44 7911 123456', '447911123456'], ['123', null], ['', null]]) {
  assert.equal(core.normalizePhone(raw), want, raw);
}

// iç ağ adresleri reddedilir
for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.9', '172.20.1.1', '169.254.1.1', '::1', 'fd00::1', '::ffff:10.0.0.1']) assert.equal(core.isPrivateAddress(ip), true, ip);
for (const ip of ['8.8.8.8', '172.32.0.1', '203.0.113.5']) assert.equal(core.isPrivateAddress(ip), false, ip);
await assert.rejects(core.assertPublicHost('127.0.0.1'), /bağlanılamaz/);

// Netgsm yanıt kodları (fetch taklit)
const real = globalThis.fetch;
const cfg = core.parseSms({ provider: 'netgsm', netgsm: { usercode: 'k', password: 'p', header: 'BASLIK' } });
let seen = '';
globalThis.fetch = async (url) => {
  seen = String(url);
  return { ok: true, status: 200, text: async () => globalThis.__reply };
};
globalThis.__reply = '00 123456789';
assert.ok((await lib.sendSms(cfg, '0532 123 45 67', 'Merhaba')).ms >= 0);
assert.ok(seen.includes('gsmno=905321234567') && seen.includes('msgheader=BASLIK'));
globalThis.__reply = '30';
await assert.rejects(lib.sendSms(cfg, '0532 123 45 67', 'x'), /şifre hatalı/);
globalThis.__reply = '40';
await assert.rejects(lib.sendSms(cfg, '0532 123 45 67', 'x'), /başlığı/);
await assert.rejects(lib.sendSms(cfg, '12', 'x'), /Telefon numarası geçersiz/);
await assert.rejects(lib.sendSms(core.DEFAULT_SMS, '0532 123 45 67', 'x'), /tüm alanlarını/);
globalThis.fetch = real;

// SMTP hata açıklamaları
assert.match(lib.explainSmtpError({ code: 'EAUTH' }), /uygulama şifresi/);
assert.match(lib.explainSmtpError({ code: 'ENOTFOUND' }), /bulunamadı/);
assert.match(lib.explainSmtpError({ code: 'ESOCKET', message: 'self-signed certificate' }), /sertifika/);
console.log('PASS: entegrasyonlar: şifreleme, ayrıştırma, gizli alan koruma, telefon biçimi, SSRF engeli, Netgsm kodları, SMTP hata metinleri.');

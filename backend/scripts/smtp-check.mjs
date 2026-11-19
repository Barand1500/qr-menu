// Sunucuda giriş maili ayarlarını dener: node scripts/smtp-check.mjs [alici@ornek.com]
// Şifreyi yazdırmaz; asıl hata kodunu ve sunucu yanıtını gösterir.
import dotenv from 'dotenv';
// Uygulama .env dosyasını çalıştığı klasörden okur; burada hem bu klasöre hem bir üstüne bakılır.
for (const p of ['.env', '../.env']) dotenv.config({ path: p });
import path from 'node:path';
import nodemailer from 'nodemailer';

const { LOGIN_SMTP_HOST, LOGIN_SMTP_PORT = '587', LOGIN_SMTP_USER, LOGIN_SMTP_PASSWORD, LOGIN_MAIL_FROM } = process.env;
const missing = ['LOGIN_SMTP_HOST', 'LOGIN_SMTP_USER', 'LOGIN_SMTP_PASSWORD', 'LOGIN_MAIL_FROM'].filter((k) => !process.env[k]);
if (missing.length) {
  console.error('Eksik ortam değişkeni:', missing.join(', '));
  console.error('Bakılan yerler:', ['.env', '../.env'].map((p) => path.resolve(p)).join('  |  '));
  console.error('Uygulamanın kullandığı .env başka bir klasördeyse oradan çalıştırın: cd <uygulama klasörü> && node backend/scripts/smtp-check.mjs');
  process.exit(1);
}
const port = Number(LOGIN_SMTP_PORT);
console.log(`Bağlanılıyor: ${LOGIN_SMTP_HOST}:${port} kullanıcı=${LOGIN_SMTP_USER} şifre uzunluğu=${LOGIN_SMTP_PASSWORD.length}`);

async function attempt(label, extra) {
  const transport = nodemailer.createTransport({
    host: LOGIN_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: LOGIN_SMTP_USER, pass: LOGIN_SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    ...extra,
  });
  try {
    await transport.verify();
    console.log(`✔ ${label}: bağlantı ve kimlik doğrulama başarılı`);
    const to = process.argv[2];
    if (to) {
      await transport.sendMail({ from: LOGIN_MAIL_FROM, to, subject: 'Menu QR SMTP denemesi', text: 'Bu bir deneme mesajıdır.' });
      console.log(`✔ Deneme maili gönderildi: ${to}`);
    }
    return true;
  } catch (e) {
    console.log(`✘ ${label}: ${e.code || ''} ${e.responseCode || ''} ${e.message}`);
    if (e.response) console.log('  sunucu yanıtı:', e.response);
    return false;
  } finally {
    transport.close();
  }
}

if (!(await attempt('normal'))) {
  console.log('\nSertifika adı uyuşmazlığı olabilir, doğrulamasız deneniyor (yalnızca teşhis):');
  if (await attempt('sertifika doğrulamasız', { tls: { rejectUnauthorized: false } })) {
    console.log('\n→ Sorun TLS sertifikası. .env içine LOGIN_SMTP_TLS_INSECURE=1 ekleyin veya LOGIN_SMTP_HOST olarak sertifikadaki ana makine adını yazın.');
  } else {
    console.log('\n→ Kimlik doğrulama başarısızsa şifreyi kontrol edin (küçük harf l ile büyük harf I karışmış olabilir).');
  }
}

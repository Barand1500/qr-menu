import nodemailer from 'nodemailer';
import {
  IntegrationError,
  assertPublicHost,
  normalizePhone,
  smsComplete,
  smtpComplete,
  type SmsConfig,
  type SmtpConfig,
} from './integrations.js';

export function smtpTransport(c: SmtpConfig) {
  return nodemailer.createTransport({
    host: c.host,
    port: c.port,
    secure: c.encryption === 'ssl',
    requireTLS: c.encryption === 'starttls',
    ignoreTLS: c.encryption === 'none',
    auth: { user: c.user, pass: c.password },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
}

export function smtpFrom(c: SmtpConfig) {
  return c.fromName ? `"${c.fromName}" <${c.fromEmail}>` : c.fromEmail;
}

/** nodemailer hatasını yöneticinin anlayacağı Türkçe bir cümleye çevirir. */
export function explainSmtpError(error: unknown): string {
  const e = error as { code?: string; responseCode?: number; message?: string };
  const text = `${e.code || ''} ${e.message || ''}`;
  if (e.code === 'EAUTH' || e.responseCode === 535) return 'Kullanıcı adı veya şifre kabul edilmedi. Gmail gibi servislerde normal şifre yerine "uygulama şifresi" gerekir.';
  if (e.code === 'ESOCKET' && /certificate|self.signed|altnames/i.test(text)) return 'Sunucunun güvenlik sertifikası doğrulanamadı. Sunucu adı sertifikadakiyle aynı olmalı.';
  if (e.code === 'ECONNECTION' || e.code === 'ECONNREFUSED') return 'Sunucuya bağlanılamadı. Adres ve port doğru mu, şifreleme türü uyuyor mu?';
  if (e.code === 'ETIMEDOUT' || e.code === 'ESOCKETTIMEDOUT') return 'Sunucu zamanında yanıt vermedi. Port engelli olabilir veya adres yanlış olabilir.';
  if (e.code === 'ENOTFOUND' || e.code === 'EDNS') return 'Sunucu adı bulunamadı. Adresi kontrol edin.';
  if (e.code === 'EENVELOPE' || e.responseCode === 550 || e.responseCode === 553) return 'Sunucu gönderen veya alıcı adresini reddetti. "Gönderen e-posta" kullanıcı hesabına ait olmalı.';
  if (/wrong version number|ssl/i.test(text)) return 'Şifreleme türü bu portla uyuşmuyor. 465 için SSL/TLS, 587 için STARTTLS deneyin.';
  return 'Gönderilemedi. Ayarları kontrol edip tekrar deneyin.';
}

export async function sendSmtpTest(c: SmtpConfig, to: string, restaurantName: string) {
  if (!smtpComplete(c)) throw new IntegrationError('Sunucu, kullanıcı, şifre ve gönderen e-posta alanlarını doldurun.');
  await assertPublicHost(c.host);
  const transport = smtpTransport(c);
  const started = Date.now();
  try {
    await transport.verify();
    await transport.sendMail({
      from: smtpFrom(c),
      to,
      subject: `${restaurantName || 'Menu QR'} · e-posta bağlantısı çalışıyor`,
      text: 'Bu bir deneme mesajıdır. E-posta ayarlarınız doğru çalışıyor.',
      html: `<div style="background:#0b0820;padding:28px 12px;font-family:Arial,sans-serif"><table role="presentation" align="center" width="100%" style="max-width:460px;background:#fff;border-radius:22px;overflow:hidden"><tr><td style="height:5px;background:#9333ea"></td></tr><tr><td style="padding:28px;color:#1c1530"><p style="margin:0 0 14px;font-size:30px">✅</p><h1 style="margin:0 0 8px;font-size:22px">Bağlantı çalışıyor</h1><p style="margin:0;font-size:15px;line-height:1.5;color:#5b5575">${restaurantName ? `${restaurantName} için ` : ''}e-posta ayarlarınız doğru. Artık bu hesaptan e-posta gönderilebilir.</p></td></tr></table></div>`,
    });
    return { ms: Date.now() - started };
  } finally {
    transport.close();
  }
}

// ───────── SMS ─────────
const NETGSM_ERRORS: Record<string, string> = {
  '20': 'Mesaj metni hatalı veya çok uzun.',
  '30': 'Kullanıcı kodu veya şifre hatalı (API erişimi kapalı olabilir).',
  '40': 'Mesaj başlığı (gönderici adı) hesabınızda tanımlı değil.',
  '50': 'Alıcı numarası hatalı.',
  '51': 'Hesabınızda gönderim yetkisi yok.',
  '70': 'Eksik veya hatalı parametre.',
  '80': 'Gönderim sınırı aşıldı.',
  '85': 'Aynı numaraya kısa sürede tekrar gönderilemez.',
};

async function timedFetch(url: string, init: RequestInit) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 12000);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal, redirect: 'error' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw new IntegrationError('SMS servisi zamanında yanıt vermedi.');
    throw new IntegrationError('SMS servisine ulaşılamadı. İnternet bağlantısını ve adresi kontrol edin.');
  } finally {
    clearTimeout(timer);
  }
}

/** Seçili sağlayıcıyla tek bir SMS gönderir. Başarısızlıkta anlaşılır bir IntegrationError fırlatır. */
export async function sendSms(c: SmsConfig, toRaw: string, message: string) {
  if (!smsComplete(c)) throw new IntegrationError('Seçili sağlayıcının tüm alanlarını doldurun.');
  const to = normalizePhone(toRaw);
  if (!to) throw new IntegrationError('Telefon numarası geçersiz. Örnek: 0532 123 45 67');
  const started = Date.now();

  if (c.provider === 'netgsm') {
    const q = new URLSearchParams({ usercode: c.netgsm.usercode, password: c.netgsm.password, gsmno: to, message, msgheader: c.netgsm.header, dil: 'TR' });
    const res = await timedFetch(`https://api.netgsm.com.tr/sms/send/get/?${q}`, {});
    const body = (await res.text()).trim();
    const code = body.split(/\s+/)[0];
    if (code !== '00' && code !== '01' && code !== '02') {
      throw new IntegrationError(NETGSM_ERRORS[code] || `Netgsm gönderimi reddetti (kod: ${code.slice(0, 12) || res.status}).`);
    }
    return { ms: Date.now() - started };
  }

  if (c.provider === 'twilio') {
    const res = await timedFetch(`https://api.twilio.com/2010-04-01/Accounts/${c.twilio.accountSid}/Messages.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${c.twilio.accountSid}:${c.twilio.authToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({ To: `+${to}`, From: c.twilio.from, Body: message }),
    });
    if (!res.ok) {
      const j = (await res.json().catch(() => ({}))) as { message?: string };
      throw new IntegrationError(res.status === 401 ? 'Account SID veya Auth Token hatalı.' : `Twilio: ${String(j.message || res.status).slice(0, 160)}`);
    }
    return { ms: Date.now() - started };
  }

  const url = new URL(c.webhook.url);
  await assertPublicHost(url.hostname);
  const res = await timedFetch(c.webhook.url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(c.webhook.token ? { Authorization: `Bearer ${c.webhook.token}` } : {}) },
    body: JSON.stringify({ to: `+${to}`, message }),
  });
  if (!res.ok) throw new IntegrationError(`Adres hata döndü (HTTP ${res.status}).`);
  return { ms: Date.now() - started };
}

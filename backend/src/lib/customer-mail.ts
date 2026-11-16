import nodemailer from 'nodemailer';

export function customerMailConfigured() {
  return Boolean(
    process.env.CUSTOMER_SMTP_HOST &&
    process.env.CUSTOMER_SMTP_USER &&
    process.env.CUSTOMER_SMTP_PASSWORD &&
    process.env.CUSTOMER_MAIL_FROM,
  );
}

export async function sendCustomerCode(
  email: string,
  code: string,
  purpose: 'register' | 'reset',
) {
  if (!customerMailConfigured()) throw new Error('CUSTOMER_MAIL_UNAVAILABLE');
  if (!/^\d{6}$/.test(code)) throw new Error('INVALID_CUSTOMER_CODE');
  const port = Number(process.env.CUSTOMER_SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.CUSTOMER_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: {
      user: process.env.CUSTOMER_SMTP_USER,
      pass: process.env.CUSTOMER_SMTP_PASSWORD,
    },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  const title =
    purpose === 'reset' ? 'Şifreni yenileyelim.' : 'Sofraya hoş geldin.';
  try {
    await transport.sendMail({
      from: process.env.CUSTOMER_MAIL_FROM,
      to: { address: email, name: '' },
      subject:
        purpose === 'reset'
          ? 'Menü hesabı şifre yenileme kodunuz'
          : 'Menü hesabı doğrulama kodunuz',
      text: `${title}\n\nDoğrulama kodunuz: ${code}\n\nKod 5 dakika geçerlidir ve tek kullanımlıktır. Kodu kimseyle paylaşmayın. Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.`,
      html: `<div style="font-family:Arial,sans-serif;background:#120e0b;color:#f6eee4;max-width:480px;margin:auto;padding:36px;border-radius:20px"><p style="color:#ffbc69;font-size:12px;letter-spacing:2px">MENÜ HESABIN</p><h1 style="font-size:28px">${title}</h1><p>Devam etmek için doğrulama kodunu gir.</p><p style="font-size:38px;font-weight:600;letter-spacing:9px;background:#ffbc691a;color:#ffbc69;padding:22px;border-radius:12px">${code}</p><p style="font-size:13px;color:#c3b3a0">5 dakika geçerlidir ve tek kullanımlıktır. Kodu kimseyle paylaşmayın.</p><p style="font-size:12px;color:#a99b8d">Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.</p></div>`,
    });
  } finally {
    transport.close();
  }
}

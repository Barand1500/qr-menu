import nodemailer from 'nodemailer';

export function loginMailConfigured() {
  return Boolean(
    process.env.LOGIN_SMTP_HOST &&
    process.env.LOGIN_SMTP_USER &&
    process.env.LOGIN_SMTP_PASSWORD &&
    process.env.LOGIN_MAIL_FROM
  );
}

export async function sendLoginCode(email: string, code: string) {
  if (!loginMailConfigured()) throw new Error('LOGIN_MAIL_UNAVAILABLE');
  const port = Number(process.env.LOGIN_SMTP_PORT || 587);
  const transport = nodemailer.createTransport({
    host: process.env.LOGIN_SMTP_HOST,
    port,
    secure: port === 465,
    requireTLS: port !== 465,
    auth: { user: process.env.LOGIN_SMTP_USER, pass: process.env.LOGIN_SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
  });
  try {
    await transport.sendMail({
      from: process.env.LOGIN_MAIL_FROM,
      to: { address: email, name: '' },
      subject: 'Menu QR giriş kodunuz',
      text: `Menu QR giriş kodunuz: ${code}\n\nBu kod 5 dakika geçerlidir ve bir kez kullanılabilir. Kodu kimseyle paylaşmayın. Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.`,
      html: `<div style="font-family:Arial,sans-serif;color:#172033;max-width:480px;margin:auto;padding:32px"><p style="font-weight:600">Menu QR</p><h1 style="font-size:24px">Giriş kodunuz</h1><p>Panelinize devam etmek için bu kodu kullanın.</p><p style="font-size:36px;font-weight:600;letter-spacing:8px;padding:20px;background:#f3f5fa;border-radius:12px">${code}</p><p>5 dakika geçerlidir. Kodu kimseyle paylaşmayın.</p><p style="font-size:12px;color:#64748b">Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.</p></div>`,
    });
  } finally {
    transport.close();
  }
}

import nodemailer from 'nodemailer';

export function loginMailConfigured() {
  return Boolean(
    process.env.LOGIN_SMTP_HOST &&
    process.env.LOGIN_SMTP_USER &&
    process.env.LOGIN_SMTP_PASSWORD &&
    process.env.LOGIN_MAIL_FROM
  );
}

/** Giriş kodu e-postası: tablo tabanlı, e-posta istemcilerinde güvenle görünen sade şablon. */
function loginMailHtml(code: string) {
  const digits = code
    .split('')
    .map(
      (d) =>
        `<td style="width:44px;height:56px;text-align:center;font-size:28px;font-weight:700;color:#1c1530;background:#f5f2fd;border:1px solid #ddd6f3;border-radius:12px">${d}</td><td style="width:6px"></td>`
    )
    .join('');
  return `<div style="background:#0b0820;padding:32px 12px;font-family:Arial,Helvetica,sans-serif">
  <table role="presentation" align="center" width="100%" style="max-width:480px;background:#ffffff;border-radius:24px;overflow:hidden">
    <tr><td style="height:5px;background:#9333ea"></td></tr>
    <tr><td style="padding:32px 28px 8px;color:#1c1530">
      <p style="margin:0 0 18px;font-size:14px;font-weight:700;color:#6d28d9">Menu QR</p>
      <h1 style="margin:0 0 8px;font-size:26px">Giriş kodunuz</h1>
      <p style="margin:0 0 22px;font-size:15px;line-height:1.5;color:#5b5575">Panelinize devam etmek için bu kodu giriş ekranına yazın.</p>
      <table role="presentation" align="center"><tr>${digits}</tr></table>
      <p style="margin:22px 0 0;font-size:13px;line-height:1.5;color:#5b5575;text-align:center">Kod <b>5 dakika</b> geçerlidir ve bir kez kullanılabilir.<br>Kodu kimseyle paylaşmayın.</p>
    </td></tr>
    <tr><td style="padding:18px 28px 28px;font-size:12px;color:#8a84a3;text-align:center">Bu isteği siz yapmadıysanız bu e-postayı yok sayabilirsiniz.<br>Güzel Teknoloji</td></tr>
  </table>
</div>`;
}

/** İşletmenin kendi SMTP ayarı (Ayarlar > Entegrasyonlar). Verilirse ortam değişkenleri yerine bu kullanılır. */
export type LoginMailSmtp = {
  host: string;
  port: number;
  encryption: 'starttls' | 'ssl' | 'none';
  user: string;
  password: string;
  from: string;
};

export async function sendLoginCode(email: string, code: string, smtp?: LoginMailSmtp | null) {
  if (!smtp && !loginMailConfigured()) throw new Error('LOGIN_MAIL_UNAVAILABLE');
  const port = smtp ? smtp.port : Number(process.env.LOGIN_SMTP_PORT || 587);
  const secure = smtp ? smtp.encryption === 'ssl' : port === 465;
  const transport = nodemailer.createTransport({
    host: smtp ? smtp.host : process.env.LOGIN_SMTP_HOST,
    port,
    secure,
    requireTLS: smtp ? smtp.encryption === 'starttls' : port !== 465,
    ...(smtp?.encryption === 'none' ? { ignoreTLS: true } : {}),
    auth: smtp ? { user: smtp.user, pass: smtp.password } : { user: process.env.LOGIN_SMTP_USER, pass: process.env.LOGIN_SMTP_PASSWORD },
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000,
    disableFileAccess: true,
    disableUrlAccess: true,
    // Yalnızca sertifika adı uyuşmuyorsa, bilinçli olarak .env ile açılır.
    ...(process.env.LOGIN_SMTP_TLS_INSECURE === '1' ? { tls: { rejectUnauthorized: false } } : {}),
  });
  try {
    await transport.sendMail({
      from: smtp ? smtp.from : process.env.LOGIN_MAIL_FROM,
      to: { address: email, name: '' },
      subject: 'Menu QR giriş kodunuz',
      text: `Menu QR giriş kodunuz: ${code}\n\nBu kod 5 dakika geçerlidir ve bir kez kullanılabilir. Kodu kimseyle paylaşmayın. Bu isteği siz yapmadıysanız mesajı yok sayabilirsiniz.`,
      html: loginMailHtml(code),
    });
  } finally {
    transport.close();
  }
}

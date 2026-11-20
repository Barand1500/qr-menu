import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Check, Eye, EyeOff, Loader2, Mail, MessageSquareText, Send, Server, ShieldCheck, X, Zap } from 'lucide-react';
import { api } from '@/lib/api';
import './integrations-settings.css';

type Encryption = 'starttls' | 'ssl' | 'none';
type SmsProvider = 'netgsm' | 'twilio' | 'webhook';

type SmtpDraft = {
  enabled: boolean;
  host: string;
  port: number;
  encryption: Encryption;
  user: string;
  fromName: string;
  fromEmail: string;
  passwordSet: boolean;
  password: string;
  clearPassword: boolean;
};
type SmsDraft = {
  enabled: boolean;
  provider: SmsProvider;
  netgsm: { usercode: string; header: string; passwordSet: boolean; password: string };
  twilio: { accountSid: string; from: string; authTokenSet: boolean; authToken: string };
  webhook: { url: string; tokenSet: boolean; token: string };
};
type Loaded = { smtp: SmtpDraft & { ready: boolean }; sms: SmsDraft & { ready: boolean }; systemMail: boolean };

const PRESETS: { id: string; name: string; host: string; port: number; encryption: Encryption; note?: string }[] = [
  { id: 'gmail', name: 'Gmail', host: 'smtp.gmail.com', port: 587, encryption: 'starttls', note: 'Gmail için normal şifre değil, Google hesabınızdan oluşturduğunuz "uygulama şifresi" gerekir.' },
  { id: 'outlook', name: 'Outlook', host: 'smtp.office365.com', port: 587, encryption: 'starttls', note: 'Microsoft 365 hesaplarında SMTP gönderimi yönetici tarafından açılmış olmalıdır.' },
  { id: 'yandex', name: 'Yandex', host: 'smtp.yandex.com.tr', port: 465, encryption: 'ssl' },
  { id: 'custom', name: 'Kendi sunucum', host: '', port: 587, encryption: 'starttls' },
];

const SMS_INFO: Record<SmsProvider, { name: string; hint: string }> = {
  netgsm: { name: 'Netgsm', hint: 'Netgsm panelinde "API erişimi" açık olmalı ve mesaj başlığınız (gönderici adı) onaylı olmalıdır.' },
  twilio: { name: 'Twilio', hint: 'Account SID ve Auth Token Twilio konsolunun ana sayfasındadır. Gönderen numara + ile başlar.' },
  webhook: { name: 'Özel adres', hint: 'Her SMS için bu HTTPS adrese {"to":"+90…","message":"…"} içeren bir POST gönderilir. Anahtar varsa "Authorization: Bearer" olarak eklenir.' },
};

type TestLog = { ok: boolean; at: number; to: string; ms?: number; message?: string };
const readLog = (key: string): TestLog[] => {
  try {
    return JSON.parse(localStorage.getItem(key) || '[]') as TestLog[];
  } catch {
    return [];
  }
};

function Field({
  label,
  value,
  onChange,
  type = 'text',
  hint,
  saved,
  inputMode,
  placeholder,
  maxLength,
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  type?: 'text' | 'password' | 'email' | 'number' | 'url';
  hint?: string;
  /** Gizli alan daha önce kaydedildi mi (boş bırakılırsa korunur) */
  saved?: boolean;
  inputMode?: 'numeric' | 'tel' | 'email' | 'url';
  placeholder?: string;
  maxLength?: number;
}) {
  const [show, setShow] = useState(false);
  const secret = type === 'password';
  return (
    <label className="ig-field">
      <input
        type={secret && !show ? 'password' : type === 'password' ? 'text' : type}
        value={value}
        inputMode={inputMode}
        maxLength={maxLength}
        autoComplete={secret ? 'new-password' : 'off'}
        placeholder={saved ? '•••••••• (kayıtlı)' : (placeholder ?? ' ')}
        onChange={(e) => onChange(e.target.value)}
      />
      <span>{label}</span>
      {secret ? (
        <button type="button" className="ig-eye" aria-label={show ? 'Gizle' : 'Göster'} onClick={() => setShow(!show)}>
          {show ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      ) : null}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

/** İki uç arasındaki "bağlantı hattı": boşta kesikli, denerken paket akar, başarıda yeşil, hatada kopuk. */
function Wire({ state, from, to }: { state: 'idle' | 'busy' | 'ok' | 'bad'; from: string; to: string }) {
  return (
    <div className={`ig-wire is-${state}`} aria-hidden="true">
      <span className="ig-wire__node">{from}</span>
      <svg viewBox="0 0 200 24" preserveAspectRatio="none">
        <line x1="2" y1="12" x2="198" y2="12" className="ig-wire__line" />
        {state === 'busy' ? <circle cx="10" cy="12" r="4.5" className="ig-wire__pkt" /> : null}
        {state === 'bad' ? <path d="M92 6l16 12M108 6L92 18" className="ig-wire__cut" /> : null}
      </svg>
      <span className="ig-wire__node">{to}</span>
      <i className="ig-wire__badge">{state === 'ok' ? <Check size={13} /> : state === 'bad' ? <X size={13} /> : null}</i>
    </div>
  );
}

function Seg<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="ig-seg" role="radiogroup" aria-label={label}>
      {options.map((o) => (
        <button key={o.id} type="button" role="radio" aria-checked={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Deneme paneli: alıcı, "Test et", gönderim adımları ve sonuç. */
function TestPanel({
  channel,
  inputLabel,
  inputMode,
  defaultTo,
  steps,
  disabledReason,
  run,
  onState,
}: {
  channel: string;
  inputLabel: string;
  inputMode: 'email' | 'tel';
  defaultTo: string;
  steps: string[];
  disabledReason: string;
  run: (to: string) => Promise<{ ms: number }>;
  onState: (s: 'idle' | 'busy' | 'ok' | 'bad') => void;
}) {
  const logKey = `integ_tests_${channel}`;
  const [to, setTo] = useState(defaultTo);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState(0);
  const [result, setResult] = useState<TestLog | null>(null);
  const [log, setLog] = useState<TestLog[]>(() => readLog(logKey));
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearInterval(timer.current), []);
  useEffect(() => setTo((t) => t || defaultTo), [defaultTo]);

  async function go() {
    if (busy || disabledReason) return;
    setBusy(true);
    setResult(null);
    setStep(0);
    onState('busy');
    timer.current = window.setInterval(() => setStep((s) => Math.min(s + 1, steps.length - 1)), 900);
    let entry: TestLog;
    try {
      const r = await run(to.trim());
      entry = { ok: true, at: Date.now(), to: to.trim(), ms: r.ms };
    } catch (e) {
      entry = { ok: false, at: Date.now(), to: to.trim(), message: e instanceof Error ? e.message : 'Gönderilemedi.' };
    }
    window.clearInterval(timer.current);
    setBusy(false);
    setResult(entry);
    onState(entry.ok ? 'ok' : 'bad');
    const next = [entry, ...log].slice(0, 3);
    setLog(next);
    try {
      localStorage.setItem(logKey, JSON.stringify(next));
    } catch {
      /* geçmiş saklanamadı */
    }
  }

  return (
    <section className="ig-test" aria-label="Bağlantıyı dene">
      <h4>
        <Zap size={16} aria-hidden /> Bağlantıyı dene
      </h4>
      <p>Kaydetmeden de deneyebilirsiniz; yazdığınız değerler kullanılır.</p>
      <div className="ig-test__row">
        <label className="ig-field">
          <input value={to} inputMode={inputMode} placeholder=" " onChange={(e) => setTo(e.target.value)} />
          <span>{inputLabel}</span>
        </label>
        <button type="button" className="ig-btn" disabled={busy || Boolean(disabledReason) || !to.trim()} onClick={() => void go()} title={disabledReason || undefined}>
          {busy ? <Loader2 size={17} className="ig-spin" aria-hidden /> : <Send size={17} aria-hidden />}
          {busy ? 'Deneniyor…' : 'Test gönder'}
        </button>
      </div>
      {disabledReason ? <p className="ig-test__why">{disabledReason}</p> : null}
      {busy ? (
        <ol className="ig-steps" aria-live="polite">
          {steps.map((s, i) => (
            <li key={s} className={i < step ? 'is-done' : i === step ? 'is-now' : ''}>
              <i>{i < step ? <Check size={12} /> : null}</i>
              {s}
            </li>
          ))}
        </ol>
      ) : null}
      {result ? (
        <div className={`ig-result ${result.ok ? 'is-ok' : 'is-bad'}`} role="status">
          <span aria-hidden>{result.ok ? <Check size={20} /> : <X size={20} />}</span>
          <div>
            <strong>{result.ok ? 'Bağlantı çalışıyor' : 'Bağlantı kurulamadı'}</strong>
            <p>{result.ok ? `${result.to} adresine gönderildi · ${result.ms} ms. Gelen kutusunu kontrol edin.` : result.message}</p>
          </div>
        </div>
      ) : null}
      {log.length ? (
        <ul className="ig-log" aria-label="Son denemeler">
          {log.map((l) => (
            <li key={l.at} className={l.ok ? 'is-ok' : 'is-bad'}>
              <i />
              <span>{new Date(l.at).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
              <em>{l.ok ? 'Başarılı' : 'Hata'}</em>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function Channel({
  icon,
  title,
  subtitle,
  enabled,
  onEnabled,
  status,
  dirty,
  saving,
  onSave,
  onReset,
  children,
}: {
  icon: ReactNode;
  title: string;
  subtitle: string;
  enabled: boolean;
  onEnabled: (v: boolean) => void;
  status: { tone: 'ok' | 'idle' | 'off'; text: string };
  dirty: boolean;
  saving: boolean;
  onSave: () => void;
  onReset: () => void;
  children: ReactNode;
}) {
  return (
    <article className={`ig-card${enabled ? ' is-on' : ''}`}>
      <header className="ig-card__head">
        <span className="ig-card__icon" aria-hidden>
          {icon}
        </span>
        <div>
          <h3>{title}</h3>
          <p>{subtitle}</p>
        </div>
        <button type="button" role="switch" aria-checked={enabled} aria-label={`${title} kullan`} className={`ig-switch${enabled ? ' is-on' : ''}`} onClick={() => onEnabled(!enabled)}>
          <i />
        </button>
      </header>
      <p className={`ig-status is-${status.tone}`}>
        <i aria-hidden /> {status.text}
      </p>
      {children}
      <footer className={`ig-save${dirty ? ' is-show' : ''}`}>
        <span>Kaydedilmemiş değişiklikler var</span>
        <button type="button" className="ig-btn ig-btn--ghost" disabled={saving} onClick={onReset}>
          Vazgeç
        </button>
        <button type="button" className="ig-btn" disabled={saving} onClick={onSave}>
          {saving ? 'Kaydediliyor…' : 'Kaydet'}
        </button>
      </footer>
    </article>
  );
}

const apiError = (e: unknown) => (e instanceof Error ? e.message : 'İşlem tamamlanamadı.');

export default function IntegrationsSettings({ onToast, adminEmail }: { onToast: (text: string, error?: boolean) => void; adminEmail?: string }) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [error, setError] = useState(false);
  const [smtp, setSmtp] = useState<SmtpDraft | null>(null);
  const [sms, setSms] = useState<SmsDraft | null>(null);
  const [saving, setSaving] = useState<'smtp' | 'sms' | null>(null);
  const [smtpWire, setSmtpWire] = useState<'idle' | 'busy' | 'ok' | 'bad'>('idle');
  const [smsWire, setSmsWire] = useState<'idle' | 'busy' | 'ok' | 'bad'>('idle');

  const hydrate = (r: Loaded) => {
    setLoaded(r);
    const { ready: _smtpReady, ...smtpBase } = r.smtp;
    const { ready: _smsReady, ...smsBase } = r.sms;
    setSmtp({ ...smtpBase, password: '', clearPassword: false });
    setSms({
      ...smsBase,
      netgsm: { ...smsBase.netgsm, password: '' },
      twilio: { ...smsBase.twilio, authToken: '' },
      webhook: { ...smsBase.webhook, token: '' },
    });
  };
  useEffect(() => {
    let alive = true;
    api<Loaded>('/api/admin/settings/integrations')
      .then((r) => alive && hydrate(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  const smtpDirty = useMemo(() => {
    if (!loaded || !smtp) return false;
    const { ready: _r, ...base } = loaded.smtp;
    return JSON.stringify({ ...base, password: '', clearPassword: false }) !== JSON.stringify(smtp);
  }, [loaded, smtp]);
  const smsDirty = useMemo(() => {
    if (!loaded || !sms) return false;
    const { ready: _r, ...base } = loaded.sms;
    const clean = { ...base, netgsm: { ...base.netgsm, password: '' }, twilio: { ...base.twilio, authToken: '' }, webhook: { ...base.webhook, token: '' } };
    return JSON.stringify(clean) !== JSON.stringify(sms);
  }, [loaded, sms]);

  if (error) return <p className="ig-note">Entegrasyon ayarları yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p>;
  if (!loaded || !smtp || !sms) return <p className="ig-note">Yükleniyor…</p>;

  async function saveSmtp() {
    setSaving('smtp');
    try {
      const res = await api<SmtpDraft & { ready: boolean }>('/api/admin/settings/integrations/smtp', { method: 'PUT', body: JSON.stringify(smtp) });
      hydrate({ ...loaded!, smtp: res });
      setSmtpWire('idle');
      onToast('E-posta ayarları kaydedildi.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setSaving(null);
    }
  }
  async function saveSms() {
    setSaving('sms');
    try {
      const res = await api<SmsDraft & { ready: boolean }>('/api/admin/settings/integrations/sms', { method: 'PUT', body: JSON.stringify(sms) });
      hydrate({ ...loaded!, sms: res });
      setSmsWire('idle');
      onToast('SMS ayarları kaydedildi.');
    } catch (e) {
      onToast(apiError(e), true);
    } finally {
      setSaving(null);
    }
  }

  const setS = (patch: Partial<SmtpDraft>) => setSmtp((d) => (d ? { ...d, ...patch } : d));
  const preset = PRESETS.find((p) => p.host && p.host === smtp.host);
  const smtpStatus = smtp.enabled
    ? loaded.smtp.ready
      ? { tone: 'ok' as const, text: `Açık · ${loaded.smtp.host} üzerinden gönderiliyor` }
      : { tone: 'idle' as const, text: 'Açık ama bilgiler eksik' }
    : { tone: 'off' as const, text: loaded.systemMail ? 'Kapalı · sistemin ortak e-posta hesabı kullanılıyor' : 'Kapalı' };
  const smtpMissing = !smtp.host || !smtp.user || !smtp.fromEmail || (!smtp.password && !smtp.passwordSet) ? 'Önce sunucu, kullanıcı, şifre ve gönderen e-postayı doldurun.' : '';

  const prov = sms.provider;
  const smsMissing =
    prov === 'netgsm'
      ? !sms.netgsm.usercode || (!sms.netgsm.password && !sms.netgsm.passwordSet) || !sms.netgsm.header
      : prov === 'twilio'
        ? !sms.twilio.accountSid || (!sms.twilio.authToken && !sms.twilio.authTokenSet) || !sms.twilio.from
        : !sms.webhook.url;
  const smsStatus = sms.enabled
    ? loaded.sms.ready
      ? { tone: 'ok' as const, text: `Açık · ${SMS_INFO[loaded.sms.provider].name}` }
      : { tone: 'idle' as const, text: 'Açık ama bilgiler eksik' }
    : { tone: 'off' as const, text: 'Kapalı' };

  return (
    <div className="ig">
      <p className="ig-lead">
        <ShieldCheck size={18} aria-hidden /> Şifreler şifreli saklanır ve ekranda bir daha gösterilmez. Boş bıraktığınız gizli alan eski değerini korur.
      </p>

      <Channel
        icon={<Mail size={22} />}
        title="E-posta (SMTP)"
        subtitle="Giriş kodları ve bildirimler bu hesaptan gider"
        enabled={smtp.enabled}
        onEnabled={(v) => setS({ enabled: v })}
        status={smtpStatus}
        dirty={smtpDirty}
        saving={saving === 'smtp'}
        onSave={() => void saveSmtp()}
        onReset={() => hydrate(loaded)}
      >
        <Wire state={smtpWire} from="Menu QR" to={smtp.host || 'Posta sunucusu'} />
        <div className="ig-presets" role="group" aria-label="Hazır ayarlar">
          {PRESETS.map((p) => (
            <button
              key={p.id}
              type="button"
              aria-pressed={p.host ? smtp.host === p.host : !PRESETS.some((x) => x.host && x.host === smtp.host)}
              onClick={() => setS({ host: p.host, port: p.port, encryption: p.encryption })}
            >
              <Server size={15} aria-hidden /> {p.name}
            </button>
          ))}
        </div>
        {preset?.note ? <p className="ig-tip">{preset.note}</p> : null}
        <div className="ig-grid">
          <Field label="Sunucu adresi" value={smtp.host} onChange={(v) => setS({ host: v.trim() })} placeholder="smtp.ornek.com" />
          <Field label="Port" type="number" inputMode="numeric" value={smtp.port} onChange={(v) => setS({ port: Number(v) || 0 })} />
        </div>
        <div className="ig-row">
          <span>Şifreleme</span>
          <Seg
            label="Şifreleme"
            value={smtp.encryption}
            onChange={(v) => setS({ encryption: v })}
            options={[
              { id: 'starttls', label: 'STARTTLS' },
              { id: 'ssl', label: 'SSL/TLS' },
              { id: 'none', label: 'Yok' },
            ]}
          />
        </div>
        <div className="ig-grid">
          <Field label="Kullanıcı adı" value={smtp.user} onChange={(v) => setS({ user: v })} />
          <Field label="Şifre" type="password" value={smtp.password} saved={smtp.passwordSet} onChange={(v) => setS({ password: v, clearPassword: false })} />
        </div>
        <div className="ig-grid">
          <Field label="Gönderen adı" value={smtp.fromName} onChange={(v) => setS({ fromName: v })} maxLength={120} />
          <Field label="Gönderen e-posta" type="email" inputMode="email" value={smtp.fromEmail} onChange={(v) => setS({ fromEmail: v.trim() })} />
        </div>
        {smtp.passwordSet ? (
          <button type="button" className="ig-link" onClick={() => setS({ password: '', passwordSet: false, clearPassword: true })}>
            Kayıtlı şifreyi sil
          </button>
        ) : null}
        <TestPanel
          channel="smtp"
          inputLabel="Deneme e-postası gidecek adres"
          inputMode="email"
          defaultTo={adminEmail ?? ''}
          steps={['Sunucuya bağlanılıyor', 'Kimlik doğrulanıyor', 'Mesaj gönderiliyor']}
          disabledReason={smtpMissing}
          onState={setSmtpWire}
          run={async (to) => {
            const res = await api<{ ms: number }>('/api/admin/settings/integrations/smtp/test', { method: 'POST', body: JSON.stringify({ to, config: smtp }) });
            return res;
          }}
        />
      </Channel>

      <Channel
        icon={<MessageSquareText size={22} />}
        title="SMS"
        subtitle="Telefon numarasına kısa mesaj göndermek için"
        enabled={sms.enabled}
        onEnabled={(v) => setSms({ ...sms, enabled: v })}
        status={smsStatus}
        dirty={smsDirty}
        saving={saving === 'sms'}
        onSave={() => void saveSms()}
        onReset={() => hydrate(loaded)}
      >
        <Wire state={smsWire} from="Menu QR" to={SMS_INFO[prov].name} />
        <div className="ig-presets" role="radiogroup" aria-label="SMS sağlayıcısı">
          {(Object.keys(SMS_INFO) as SmsProvider[]).map((p) => (
            <button key={p} type="button" role="radio" aria-checked={prov === p} onClick={() => setSms({ ...sms, provider: p })}>
              {SMS_INFO[p].name}
            </button>
          ))}
        </div>
        <p className="ig-tip">{SMS_INFO[prov].hint}</p>
        {prov === 'netgsm' ? (
          <div className="ig-grid">
            <Field label="Kullanıcı kodu" value={sms.netgsm.usercode} onChange={(v) => setSms({ ...sms, netgsm: { ...sms.netgsm, usercode: v } })} />
            <Field label="API şifresi" type="password" value={sms.netgsm.password} saved={sms.netgsm.passwordSet} onChange={(v) => setSms({ ...sms, netgsm: { ...sms.netgsm, password: v } })} />
            <Field label="Mesaj başlığı" value={sms.netgsm.header} maxLength={11} onChange={(v) => setSms({ ...sms, netgsm: { ...sms.netgsm, header: v } })} hint="En çok 11 karakter" />
          </div>
        ) : null}
        {prov === 'twilio' ? (
          <div className="ig-grid">
            <Field label="Account SID" value={sms.twilio.accountSid} onChange={(v) => setSms({ ...sms, twilio: { ...sms.twilio, accountSid: v.trim() } })} />
            <Field label="Auth Token" type="password" value={sms.twilio.authToken} saved={sms.twilio.authTokenSet} onChange={(v) => setSms({ ...sms, twilio: { ...sms.twilio, authToken: v } })} />
            <Field label="Gönderen numara" value={sms.twilio.from} onChange={(v) => setSms({ ...sms, twilio: { ...sms.twilio, from: v } })} hint="Örn. +15551234567" />
          </div>
        ) : null}
        {prov === 'webhook' ? (
          <div className="ig-grid">
            <Field label="HTTPS adresi" type="url" inputMode="url" value={sms.webhook.url} onChange={(v) => setSms({ ...sms, webhook: { ...sms.webhook, url: v.trim() } })} placeholder="https://…" />
            <Field label="Erişim anahtarı (isteğe bağlı)" type="password" value={sms.webhook.token} saved={sms.webhook.tokenSet} onChange={(v) => setSms({ ...sms, webhook: { ...sms.webhook, token: v } })} />
          </div>
        ) : null}
        <TestPanel
          channel="sms"
          inputLabel="Deneme SMS'i gidecek numara"
          inputMode="tel"
          defaultTo=""
          steps={['Sağlayıcıya bağlanılıyor', 'Hesap doğrulanıyor', 'SMS gönderiliyor']}
          disabledReason={smsMissing ? 'Önce seçili sağlayıcının alanlarını doldurun.' : ''}
          onState={setSmsWire}
          run={async (to) => api<{ ms: number }>('/api/admin/settings/integrations/sms/test', { method: 'POST', body: JSON.stringify({ to, config: sms }) })}
        />
      </Channel>
    </div>
  );
}

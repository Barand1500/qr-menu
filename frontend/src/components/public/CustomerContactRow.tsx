import { customerProfileUi } from '@/lib/customerProfileUi';
import { useEffect, useRef, useState, type ClipboardEvent, type KeyboardEvent, type ReactNode } from 'react';
import { Check, Loader2, Pencil, X } from 'lucide-react';
import { useCustomerAuth, type ContactField, type ContactRequestResult } from '@/contexts/CustomerAuthContext';

/** Girilen telefonu 5XX XXX XX XX biçiminde gösterir. */
function formatPhone(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 10);
  return [d.slice(0, 3), d.slice(3, 6), d.slice(6, 8), d.slice(8)].filter(Boolean).join(' ');
}

function Otp6({ value, disabled, onChange, lang }: { value: string; disabled: boolean; onChange: (v: string) => void; lang: string }) {
  const ui = customerProfileUi(lang);
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  useEffect(() => {
    refs.current[Math.min(value.length, 5)]?.focus();
  }, [value.length]);
  const key = (i: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      onChange(value.slice(0, i - 1));
    }
  };
  const paste = (e: ClipboardEvent<HTMLInputElement>) => {
    const t = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (t) {
      e.preventDefault();
      onChange(t);
    }
  };
  return (
    <div className="ca-otp" role="group" aria-label={ui.otpLabel}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`${i + 1}. ${ui.digit}`}
          value={d}
          disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (ch) onChange((value.slice(0, i) + ch).slice(0, 6));
          }}
        />
      ))}
    </div>
  );
}

/**
 * Telefon / e-posta satırı: değer + "Değiştir". Değiştirince yeni değer yazılır, kod gönderilir (SMS veya e-posta),
 * kod girilince hesap güncellenir. Hepsi satırın içinde açılır; ayrı pencere yok.
 */
export function ContactRow({
  lang = 'tr',
  field,
  label,
  current,
  restaurantId,
  visibility,
  note,
}: {
  lang?: string;
  field: ContactField;
  label: ReactNode;
  current: string | null;
  restaurantId?: number | null;
  /** Restoranlara görünürlük düğmesi */
  visibility: ReactNode;
  note?: ReactNode;
}) {
  const ui = customerProfileUi(lang);
  const { requestContactChange, verifyContactChange } = useCustomerAuth();
  const [mode, setMode] = useState<'view' | 'edit' | 'code'>('view');
  const [value, setValue] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState<ContactRequestResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  const [until, setUntil] = useState(0);
  const [now, setNow] = useState(Date.now());
  const busyRef = useRef(false);
  const left = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (mode !== 'code') return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [mode]);

  const isPhone = field === 'phone';
  const valid = isPhone ? /^5\d{9}$/.test(value.replace(/\D/g, '').replace(/^0/, '')) : /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const shown = isPhone ? (current ? formatPhone(current) : '—') : current || '—';
  const payload = () => (isPhone ? value.replace(/\D/g, '').replace(/^0/, '') : value.trim().toLowerCase());

  function reset() {
    setMode('view');
    setValue('');
    setCode('');
    setSent(null);
    setError('');
  }

  async function sendCode() {
    if (busyRef.current || !valid || !restaurantId) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await requestContactChange(field, payload(), restaurantId);
      setSent(res);
      setCode('');
      setUntil(Date.now() + res.retryAfter * 1000);
      setNow(Date.now());
      setMode('code');
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.sendError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  async function verify(c: string) {
    if (busyRef.current || !sent || !restaurantId) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      await verifyContactChange(field, payload(), sent.challengeId, c, restaurantId);
      reset();
      setDone(true);
      window.setTimeout(() => setDone(false), 2600);
    } catch (e) {
      setCode('');
      setError(e instanceof Error ? e.message : ui.verifyError);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  // 6 hane tamamlanınca kendiliğinden doğrula
  useEffect(() => {
    if (mode === 'code' && code.length === 6) void verify(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, mode]);

  return (
    <div className={`ca-row${mode !== 'view' ? ' is-editing' : ''}`}>
      <div className="ca-row__head">
        <span>{label}</span>
        {visibility}
      </div>

      {mode === 'view' ? (
        <div className="ca-val">
          <p className="ca-static">{shown}</p>
          <button type="button" className="ca-edit" disabled={!restaurantId} onClick={() => setMode('edit')}>
            <Pencil size={14} aria-hidden /> {ui.change}
          </button>
        </div>
      ) : null}
      {done ? (
        <p className="ca-ok" role="status">
          <Check size={15} aria-hidden /> {isPhone ? ui.phoneUpdated : ui.emailUpdated}
        </p>
      ) : null}

      {mode === 'edit' ? (
        <div className="ca-edit-box">
          <input
            autoFocus
            type={isPhone ? 'tel' : 'email'}
            inputMode={isPhone ? 'tel' : 'email'}
            autoComplete={isPhone ? 'tel' : 'email'}
            placeholder={isPhone ? ui.newPhone : ui.newEmail}
            aria-label={isPhone ? ui.newPhone : ui.newEmail}
            value={value}
            disabled={busy}
            onChange={(e) => setValue(isPhone ? formatPhone(e.target.value) : e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void sendCode();
              }
            }}
          />
          <div className="ca-edit-actions">
            <button type="button" className="ca-mini ca-mini--ghost" disabled={busy} onClick={reset}>
              <X size={14} aria-hidden /> {ui.cancel}
            </button>
            <button type="button" className="ca-mini" disabled={busy || !valid} onClick={() => void sendCode()}>
              {busy ? <Loader2 size={14} className="is-spin" aria-hidden /> : null} {ui.sendCode}
            </button>
          </div>
        </div>
      ) : null}

      {mode === 'code' && sent ? (
        <div className="ca-edit-box">
          <p className="ca-edit-info">
            <b>{sent.maskedTo}</b> {sent.channel === 'sms' ? ui.codeSms : ui.codeEmail}
            {sent.channel === 'email' && isPhone ? ` (${ui.phoneViaEmail})` : ''}
            {sent.channel === 'sms' && !isPhone ? ` (${ui.emailViaPhone})` : ''}
          </p>
          <Otp6 lang={lang} value={code} disabled={busy} onChange={setCode} />
          <div className="ca-edit-actions">
            <button type="button" className="ca-mini ca-mini--ghost" disabled={busy} onClick={reset}>
              <X size={14} aria-hidden /> {ui.cancel}
            </button>
            <button type="button" className="ca-mini ca-mini--ghost" disabled={busy || left > 0} onClick={() => void sendCode()}>
              {left > 0 ? `${ui.resend} · ${left} ${ui.seconds}` : ui.resend}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="ca-bad" role="alert">
          {error}
        </p>
      ) : null}
      {note}
    </div>
  );
}

/** Ad soyad: doğrudan düzenlenir; değişince yanında "Kaydet" çıkar, kod gerekmez. */
export function NameRow({ label, visibility, lang = 'tr' }: { label: ReactNode; visibility: ReactNode; lang?: string }) {
  const ui = customerProfileUi(lang);
  const { customer, updateProfile } = useCustomerAuth();
  const [name, setName] = useState(customer?.fullName ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);
  useEffect(() => setName(customer?.fullName ?? ''), [customer?.fullName]);
  const changed = name.trim() !== (customer?.fullName ?? '') && name.trim().length >= 2;

  async function save() {
    setBusy(true);
    setError('');
    try {
      await updateProfile({ fullName: name.trim() });
      setDone(true);
      window.setTimeout(() => setDone(false), 2200);
    } catch (e) {
      setError(e instanceof Error ? e.message : ui.saveError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="ca-row">
      <div className="ca-row__head">
        <label htmlFor="ca-name">{label}</label>
        {visibility}
      </div>
      <div className="ca-name">
        <input
          id="ca-name"
          value={name}
          autoComplete="name"
          maxLength={150}
          disabled={busy}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && changed) {
              e.preventDefault();
              void save();
            }
          }}
        />
        {changed ? (
          <button type="button" className="ca-mini" disabled={busy} onClick={() => void save()}>
            {busy ? <Loader2 size={14} className="is-spin" aria-hidden /> : <Check size={14} aria-hidden />} {ui.save}
          </button>
        ) : null}
      </div>
      {done ? (
        <p className="ca-ok" role="status">
          <Check size={15} aria-hidden /> {ui.nameUpdated}
        </p>
      ) : null}
      {error ? (
        <p className="ca-bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

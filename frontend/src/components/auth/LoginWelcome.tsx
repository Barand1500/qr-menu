import {
  useEffect,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  QrCode,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import './login-welcome.css';

type Step = 'email' | 'method' | 'code' | 'password';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LAST_EMAIL_KEY = 'admin_last_email';

function greeting() {
  const h = new Date().getHours();
  if (h < 5) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

function readLastEmail() {
  try {
    return localStorage.getItem(LAST_EMAIL_KEY) || '';
  } catch {
    return '';
  }
}

/** 6 kutulu doğrulama kodu girişi: otomatik ilerler, yapıştırmayı ve geri silmeyi destekler. */
function OtpInput({
  value,
  disabled,
  onChange,
}: {
  value: string;
  disabled: boolean;
  onChange: (next: string) => void;
}) {
  const refs = useRef<Array<HTMLInputElement | null>>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] || '');
  useEffect(() => {
    refs.current[Math.min(value.length, 5)]?.focus();
  }, [value.length]);
  function key(i: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      e.preventDefault();
      onChange(value.slice(0, i - 1));
    } else if (e.key === 'ArrowLeft' && i > 0) refs.current[i - 1]?.focus();
    else if (e.key === 'ArrowRight' && i < 5) refs.current[i + 1]?.focus();
  }
  function paste(e: ClipboardEvent<HTMLInputElement>) {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (text) {
      e.preventDefault();
      onChange(text);
    }
  }
  return (
    <div className="lw-otp" role="group" aria-label="6 haneli doğrulama kodu">
      {digits.map((d, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          className={d ? 'is-filled' : ''}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          maxLength={1}
          aria-label={`${i + 1}. hane`}
          value={d}
          disabled={disabled}
          onFocus={(e) => e.currentTarget.select()}
          onKeyDown={(e) => key(i, e)}
          onPaste={paste}
          onChange={(e) => {
            const ch = e.target.value.replace(/\D/g, '').slice(-1);
            if (!ch) return;
            onChange((value.slice(0, i) + ch).slice(0, 6));
          }}
        />
      ))}
    </div>
  );
}

export default function LoginWelcome({ onContact }: { onContact: () => void }) {
  const { user, login, loginWithCode } = useAuth();
  const [step, setStep] = useState<Step>('email');
  const [dir, setDir] = useState<'fwd' | 'back'>('fwd');
  const [email, setEmail] = useState(readLastEmail);
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [shake, setShake] = useState(0);
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const sceneRef = useRef<HTMLDivElement>(null);
  const first = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  const emailOk = EMAIL_RE.test(email.trim());

  useEffect(() => {
    if (step === 'code') return;
    const frame = requestAnimationFrame(() => first.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    if (step !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);

  // İmleci izleyen ışık: yalnızca CSS değişkeni, yeniden çizim yok.
  useEffect(() => {
    const scene = sceneRef.current;
    if (!scene || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const move = (e: PointerEvent) => {
      scene.style.setProperty('--mx', `${e.clientX}px`);
      scene.style.setProperty('--my', `${e.clientY}px`);
    };
    window.addEventListener('pointermove', move, { passive: true });
    return () => window.removeEventListener('pointermove', move);
  }, []);

  function go(next: Step, direction: 'fwd' | 'back' = 'fwd') {
    if (pending.current) return;
    setDir(direction);
    setError('');
    setPassword('');
    setCode('');
    setShowPassword(false);
    setStep(next);
  }
  function fail(message: string) {
    setError(message);
    setShake((n) => n + 1);
  }

  async function sendCode() {
    if (pending.current || !emailOk) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const clean = email.trim().toLowerCase();
      const res = await api<{ challengeId: string; retryAfter: number }>('/api/auth/login/code/request', {
        method: 'POST',
        body: JSON.stringify({ email: clean }),
      });
      setEmail(clean);
      setChallenge(res.challengeId);
      setCode('');
      setRetryAt(Date.now() + res.retryAfter * 1000);
      setNow(Date.now());
      setDir('fwd');
      setStep('code');
    } catch (err) {
      fail(err instanceof Error ? err.message : 'Kod gönderilemedi. Tekrar deneyin.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  async function finish(kind: 'code' | 'password', secret: string) {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (kind === 'password') await login(email.trim(), secret, remember);
      else await loginWithCode(email.trim(), challenge, secret, remember);
      try {
        localStorage.setItem(LAST_EMAIL_KEY, email.trim().toLowerCase());
      } catch {
        /* sorun değil */
      }
    } catch (err) {
      if (kind === 'code') setCode('');
      fail(err instanceof Error ? err.message : 'Giriş tamamlanamadı. Tekrar deneyin.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }

  function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 'email') {
      if (emailOk) go('method');
      else fail('Geçerli bir e-posta adresi yazın.');
    } else if (step === 'password') void finish('password', password);
    else if (step === 'code' && code.length === 6) void finish('code', code);
  }

  // Kod tamamlanınca kendiliğinden giriş yap.
  useEffect(() => {
    if (step === 'code' && code.length === 6 && !pending.current) void finish('code', code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, step]);

  if (user) return <Navigate to={adminPath()} replace />;

  const initial = (email.trim().charAt(0) || '?').toLocaleUpperCase('tr');
  const identity = (
    <button type="button" className="lw-id" disabled={busy} onClick={() => go('email', 'back')}>
      <span aria-hidden>{initial}</span>
      <em>{email}</em>
      <small>Değiştir</small>
    </button>
  );

  return (
    <div className="lw" ref={sceneRef}>
      <div className="lw-bg" aria-hidden>
        <i className="lw-blob lw-blob--a" />
        <i className="lw-blob lw-blob--b" />
        <i className="lw-blob lw-blob--c" />
        <i className="lw-dots" />
        <i className="lw-spot" />
      </div>

      <header className="lw-head">
        <a href="/login" className="lw-brand">
          <span>
            <QrCode size={20} />
          </span>
          Menu QR
        </a>
        <button type="button" onClick={onContact}>
          İletişim
        </button>
      </header>

      <main className="lw-main">
        <section className="lw-hero">
          <p className="lw-eyebrow">
            <i /> Restoran yönetim paneli
          </p>
          <h1>
            {greeting()},
            <br />
            <span>hoş geldiniz.</span>
          </h1>
          <p className="lw-lead">Menünüz, masalarınız ve misafirleriniz tek yerde.</p>
          <ul className="lw-points">
            <li>
              <Zap size={16} /> Şifresiz, tek kodla giriş
            </li>
            <li>
              <ShieldCheck size={16} /> Size özel, korumalı alan
            </li>
          </ul>
        </section>

        <section className={`lw-card${shake ? ' is-shake' : ''}`} key={shake} aria-label="Hesaba giriş">
          <span className="lw-card__shine" aria-hidden />
          <div className={`lw-step lw-step--${dir}`} key={step}>
            {step !== 'email' && step !== 'method' ? (
              <button
                type="button"
                className="lw-back"
                disabled={busy}
                onClick={() => go('method', 'back')}
              >
                <ArrowLeft size={16} /> Giriş yöntemi
              </button>
            ) : null}

            <h2>
              {step === 'email'
                ? 'Hesabınıza girin'
                : step === 'method'
                  ? 'Nasıl girmek istersiniz?'
                  : step === 'code'
                    ? 'Kodu yazın'
                    : 'Şifrenizi yazın'}
            </h2>
            <p className="lw-sub">
              {step === 'email'
                ? 'E-posta adresinizi yazın, gerisini biz hallederiz.'
                : step === 'method'
                  ? 'İkisi de güvenli; hızlı giriş şifre hatırlamanızı gerektirmez.'
                  : step === 'code'
                    ? 'Gelen kutunuza 6 haneli bir kod gönderdik. 5 dakika geçerli.'
                    : 'Hesabınızın şifresi ile devam edin.'}
            </p>

            {step !== 'email' ? identity : null}
            {error ? (
              <p className="lw-error" role="alert">
                {error}
              </p>
            ) : null}

            <form onSubmit={submit} noValidate>
              {step === 'email' ? (
                <>
                  <label className="lw-field">
                    <input
                      ref={first}
                      type="email"
                      name="email"
                      autoComplete="username"
                      inputMode="email"
                      maxLength={150}
                      placeholder=" "
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                    <span>E-posta adresi</span>
                  </label>
                  <button type="submit" className="lw-btn" disabled={!emailOk}>
                    Devam et <ArrowRight size={18} />
                  </button>
                </>
              ) : null}

              {step === 'method' ? (
                <div className="lw-methods">
                  <button type="button" className="lw-method is-primary" disabled={busy} onClick={() => void sendCode()}>
                    <span className="lw-method__icon">
                      {busy ? <Loader2 size={20} className="lw-spin" /> : <Zap size={20} />}
                    </span>
                    <span>
                      <strong>Hızlı giriş</strong>
                      <small>{busy ? 'Kod gönderiliyor…' : 'E-postanıza tek kullanımlık kod gönderelim'}</small>
                    </span>
                    <em>Önerilen</em>
                  </button>
                  <button type="button" className="lw-method" disabled={busy} onClick={() => go('password')}>
                    <span className="lw-method__icon">
                      <KeyRound size={20} />
                    </span>
                    <span>
                      <strong>Şifreyle giriş</strong>
                      <small>Hesap şifrenizi yazın</small>
                    </span>
                    <ArrowRight size={18} />
                  </button>
                </div>
              ) : null}

              {step === 'code' ? (
                <>
                  <OtpInput value={code} disabled={busy} onChange={setCode} />
                  <label className="lw-check">
                    <input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />
                    <i>
                      <Check size={12} />
                    </i>
                    Beni hatırla
                  </label>
                  <button type="submit" className="lw-btn" disabled={busy || code.length !== 6}>
                    {busy ? <Loader2 size={18} className="lw-spin" /> : <Check size={18} />}
                    {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
                  </button>
                  <div className="lw-links">
                    <button type="button" disabled={busy || remaining > 0} onClick={() => void sendCode()}>
                      {remaining > 0 ? `Tekrar gönder · ${remaining} sn` : 'Kodu tekrar gönder'}
                    </button>
                    <button type="button" disabled={busy} onClick={() => go('password')}>
                      Şifreyle gir
                    </button>
                  </div>
                </>
              ) : null}

              {step === 'password' ? (
                <>
                  <label className="lw-field">
                    <input
                      ref={first}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      autoComplete="current-password"
                      placeholder=" "
                      value={password}
                      disabled={busy}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                    <span>Şifre</span>
                    <button
                      type="button"
                      className="lw-eye"
                      aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                    </button>
                  </label>
                  <label className="lw-check">
                    <input type="checkbox" checked={remember} disabled={busy} onChange={(e) => setRemember(e.target.checked)} />
                    <i>
                      <Check size={12} />
                    </i>
                    Beni hatırla
                  </label>
                  <button type="submit" className="lw-btn" disabled={busy || !password}>
                    {busy ? <Loader2 size={18} className="lw-spin" /> : <ArrowRight size={18} />}
                    {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
                  </button>
                  <div className="lw-links">
                    <button type="button" disabled={busy} onClick={() => void sendCode()}>
                      Şifremi hatırlamıyorum, kodla gireyim
                    </button>
                  </div>
                </>
              ) : null}
            </form>
          </div>

          <footer className="lw-foot">
            <button type="button" onClick={onContact}>
              Yardım mı lazım?
            </button>
            <span>
              <ShieldCheck size={13} /> Güvenli giriş
            </span>
          </footer>
        </section>
      </main>

      <footer className="lw-copy">Güzel Teknoloji © {new Date().getFullYear()}</footer>
    </div>
  );
}

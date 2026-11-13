import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Mail,
  QrCode,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import './login-welcome.css';

type Step = 'start' | 'email' | 'code' | 'password';
export default function LoginWelcome({ onContact }: { onContact: () => void }) {
  const { user, login, loginWithCode } = useAuth();
  const [step, setStep] = useState<Step>('start');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [challenge, setChallenge] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [retryAt, setRetryAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const input = useRef<HTMLInputElement>(null);
  const pending = useRef(false);
  useEffect(() => {
    if (step === 'start') return;
    const frame = requestAnimationFrame(() => input.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, [step]);
  useEffect(() => {
    if (step !== 'code') return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [step]);
  const remaining = Math.max(0, Math.ceil((retryAt - now) / 1000));
  function changeStep(next: Step) {
    if (pending.current) return;
    setError('');
    setPassword('');
    setCode('');
    setShowPassword(false);
    setStep(next);
  }
  function emailValid() {
    if (step === 'email' && !input.current?.reportValidity()) return false;
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  }
  async function sendCode() {
    if (pending.current || !emailValid()) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const res = await api<{ challengeId: string; retryAfter: number; expiresIn: number }>(
        '/api/auth/login/code/request',
        { method: 'POST', body: JSON.stringify({ email: email.trim().toLowerCase() }) }
      );
      setEmail(email.trim().toLowerCase());
      setChallenge(res.challengeId);
      setCode('');
      setRetryAt(Date.now() + res.retryAfter * 1000);
      setNow(Date.now());
      setStep('code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kod gönderilemedi. Tekrar deneyin.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (step === 'email') {
      await sendCode();
      return;
    }
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      if (step === 'password') await login(email.trim(), password, remember);
      else if (step === 'code') await loginWithCode(email.trim(), challenge, code, remember);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş tamamlanamadı. Tekrar deneyin.');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (user) return <Navigate to={adminPath()} replace />;
  return (
    <div className={`login-scene login-welcome${step === 'start' ? '' : ' is-authenticating'}`}>
      <header className="login-welcome__header">
        <a href="/login" className="login-welcome__brand">
          <span>
            <QrCode size={22} />
          </span>
          Menu QR
        </a>
        <button type="button" onClick={onContact}>
          İletişim
        </button>
      </header>
      <div className="login-welcome__waves" aria-hidden>
        <svg viewBox="0 0 1440 200" preserveAspectRatio="none">
          <path
            d="M0,200 L0,120 Q200,60 400,100 T800,80 T1200,110 T1440,90 L1440,200 Z"
            fill="rgba(0,0,0,0.3)"
          />
          <path
            d="M0,200 L0,140 Q300,80 600,130 T1000,100 T1440,130 L1440,200 Z"
            fill="rgba(0,0,0,0.2)"
          />
        </svg>
      </div>
      <main className="login-welcome__layout">
        <section className="login-welcome__intro">
          <p className="login-welcome__eyebrow">RESTORANINIZIN YÖNETİM PANELİ</p>
          <h1>
            Güzel bir güne,
            <br />
            hoş geldiniz.
          </h1>
          <p>
            Menünüz, misafirleriniz ve işletmeniz.
            <br />
            Her şey tek bir yerde, sizin kontrolünüzde.
          </p>
          <span className="login-welcome__signature">
            <span /> Güzel Teknoloji
          </span>
        </section>
        <section className="login-access" aria-label="Hesaba giriş">
          <div className="login-access__step" key={step}>
            {step !== 'start' && (
              <button
                type="button"
                className="login-access__back"
                disabled={busy}
                onClick={() => changeStep(step === 'email' ? 'start' : 'email')}
              >
                <ArrowLeft size={16} />
                {step === 'email' ? 'Geri' : 'E-postayı değiştir'}
              </button>
            )}
            <span className="login-access__eyebrow">MENU QR HESABINIZ</span>
            <h2>
              {step === 'start'
                ? 'Kaldığınız yerden.'
                : step === 'email'
                  ? 'E-posta ile devam edin.'
                  : step === 'code'
                    ? 'Gelen kutunuza bakın.'
                    : 'Tekrar hoş geldiniz.'}
            </h2>
            <p className="login-access__subtitle">
              {step === 'start'
                ? 'Panelinize devam etmek için başlayın.'
                : step === 'email'
                  ? 'Hesabınızın e-posta adresini girin.'
                  : step === 'code'
                    ? 'Hesabınız uygunsa 6 haneli giriş kodu e-postanıza gönderildi. Kod 5 dakika geçerlidir.'
                    : 'Hesabınızın şifresini girin.'}
            </p>
            {step === 'start' ? (
              <button
                type="button"
                className="login-access__primary"
                onClick={() => changeStep('email')}
              >
                <Mail size={19} /> E-posta ile devam et <ArrowRight size={18} />
              </button>
            ) : (
              <form onSubmit={submit}>
                {step !== 'email' && (
                  <div className="login-access__email">
                    <Mail size={15} />
                    <span>{email}</span>
                  </div>
                )}
                {error && (
                  <p className="login-access__error" role="alert">
                    {error}
                  </p>
                )}
                <label className="login-access__field">
                  {step === 'email'
                    ? 'E-posta adresi'
                    : step === 'code'
                      ? 'Doğrulama kodu'
                      : 'Şifre'}
                  <span className="login-access__input-wrap">
                    {step === 'email' ? (
                      <input
                        ref={input}
                        name="email"
                        type="email"
                        required
                        maxLength={150}
                        autoComplete="username"
                        pattern="[^\s@]+@[^\s@]+\.[^\s@]+"
                        placeholder="siz@restoran.com"
                        value={email}
                        disabled={busy}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    ) : step === 'code' ? (
                      <input
                        ref={input}
                        className="login-access__code"
                        name="code"
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        required
                        pattern="[0-9]{6}"
                        minLength={6}
                        maxLength={6}
                        placeholder="000000"
                        value={code}
                        disabled={busy}
                        onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                      />
                    ) : (
                      <>
                        <input
                          ref={input}
                          name="password"
                          type={showPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          value={password}
                          disabled={busy}
                          onChange={(e) => setPassword(e.target.value)}
                        />
                        <button
                          type="button"
                          className="login-access__eye"
                          aria-label={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'}
                          onClick={() => setShowPassword(!showPassword)}
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </>
                    )}
                  </span>
                </label>
                {step !== 'email' && (
                  <label className="login-access__remember">
                    <input
                      type="checkbox"
                      checked={remember}
                      disabled={busy}
                      onChange={(e) => setRemember(e.target.checked)}
                    />
                    Beni hatırla
                  </label>
                )}
                {step === 'email' ? (
                  <div className="login-access__methods">
                    <button type="submit" className="login-access__primary" disabled={busy}>
                      {busy ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}{' '}
                      {busy ? 'Kod gönderiliyor…' : 'Hızlı giriş'}
                    </button>
                    <button
                      type="button"
                      className="login-access__secondary"
                      disabled={busy}
                      onClick={() => {
                        if (emailValid()) changeStep('password');
                      }}
                    >
                      <KeyRound size={18} /> Şifreli giriş
                    </button>
                  </div>
                ) : (
                  <>
                    <button
                      type="submit"
                      className="login-access__primary"
                      disabled={busy || (step === 'code' ? code.length !== 6 : !password)}
                    >
                      {busy ? (
                        <Loader2 size={18} className="animate-spin" />
                      ) : (
                        <ArrowRight size={18} />
                      )}{' '}
                      {busy ? 'Giriş yapılıyor…' : 'Devam et'}
                    </button>
                    {step === 'code' && (
                      <div className="login-access__code-actions">
                        <button
                          type="button"
                          disabled={busy || remaining > 0}
                          onClick={() => void sendCode()}
                        >
                          {remaining > 0 ? `Tekrar gönder · ${remaining} sn` : 'Kodu tekrar gönder'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => changeStep('password')}
                        >
                          Şifre ile giriş yap
                        </button>
                      </div>
                    )}
                  </>
                )}
              </form>
            )}
          </div>
          <footer className="login-access__footer">
            <button type="button" onClick={onContact}>
              Yardıma mı ihtiyacınız var?
            </button>
            <span>
              <Check size={13} /> Size özel yönetim alanı
            </span>
          </footer>
        </section>
      </main>
      <footer className="login-welcome__footer">
        Güzel Teknoloji © {new Date().getFullYear()}
      </footer>
    </div>
  );
}

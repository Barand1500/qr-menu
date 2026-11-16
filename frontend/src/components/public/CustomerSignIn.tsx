import { useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  QrCode,
  ShieldCheck,
  Sparkles,
  Utensils,
  X,
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { useSheetFocus } from './sofra/SofraSheet';
import {
  customerEmailRequest,
  CustomerEmailApiError,
  type EmailChallenge,
  type EmailPurpose,
} from '@/lib/customerEmailAuth';
import './customer-sign-in.css';

type Step = 'options' | 'email' | 'password' | 'code' | 'create';
export default function CustomerSignIn({
  onClose,
  restaurantName,
  lang = 'tr',
}: {
  onClose: () => void;
  restaurantName?: string;
  lang?: string;
}) {
  const { login, completeEmail } = useCustomerAuth();
  const en = lang.split('-')[0] !== 'tr';
  const id = useId();
  const [step, setStep] = useState<Step>('options');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [code, setCode] = useState('');
  const [purpose, setPurpose] = useState<EmailPurpose>('register');
  const [challenge, setChallenge] = useState<EmailChallenge | null>(null);
  const [grant, setGrant] = useState('');
  const [resendAt, setResendAt] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [remember, setRemember] = useState(true);
  const [consent, setConsent] = useState(false);
  const panel = useSheetFocus(true, onClose);
  const input = useRef<HTMLInputElement>(null);
  const remaining = Math.max(0, Math.ceil((resendAt - now) / 1000));
  const normalizedEmail = email.trim().toLowerCase();
  const titles = en
    ? {
        options: 'Good taste.\nGreat company.',
        email: 'Let’s get acquainted.',
        password: 'Welcome back.',
        code: 'Check your inbox.',
        create: 'Make it yours.',
      }
    : {
        options: 'Bir hesap.\nDaha çok keyif.',
        email: 'Seni tanıyalım.',
        password: 'Tekrar hoş geldin.',
        code: 'Gelen kutuna bak.',
        create: 'Şifreni belirle.',
      };

  useEffect(() => {
    input.current?.focus();
  }, [step]);
  useEffect(() => {
    if (resendAt <= Date.now()) return;
    const timer = window.setInterval(() => {
      const current = Date.now();
      setNow(current);
      if (current >= resendAt) window.clearInterval(timer);
    }, 500);
    return () => window.clearInterval(timer);
  }, [resendAt]);
  async function run(action: () => Promise<void>) {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await action();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : en
            ? 'Please try again.'
            : 'Lütfen tekrar deneyin.',
      );
      if (err instanceof CustomerEmailApiError && err.retryAfter > 0) {
        setResendAt(Date.now() + err.retryAfter * 1000);
        setNow(Date.now());
      }
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
  function receive(next: EmailChallenge, kind: EmailPurpose) {
    setChallenge(next);
    setPurpose(kind);
    setCode('');
    setGrant('');
    setPassword('');
    setResendAt(Date.now() + next.retryAfter * 1000);
    setNow(Date.now());
    setStep('code');
  }
  function back() {
    setError('');
    setMessage('');
    setPassword('');
    setShowPassword(false);
    setCode('');
    setGrant('');
    setChallenge(null);
    setStep(step === 'email' ? 'options' : 'email');
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    await run(async () => {
      if (step === 'email') {
        const next = await customerEmailRequest<
          EmailChallenge & { step: 'password' | 'code' }
        >('start', { email: normalizedEmail });
        setEmail(normalizedEmail);
        if (next.step === 'password') {
          setPassword('');
          setStep('password');
        } else receive(next, 'register');
      } else if (step === 'password') {
        await login({
          loginType: 'email',
          email: normalizedEmail,
          password,
          remember,
        });
        onClose();
      } else if (step === 'code' && challenge) {
        const next = await customerEmailRequest<{ verificationToken: string }>(
          'verify',
          {
            email: normalizedEmail,
            purpose,
            challengeId: challenge.challengeId,
            code,
          },
        );
        setGrant(next.verificationToken);
        setPassword('');
        setShowPassword(false);
        setStep('create');
      } else if (step === 'create') {
        const result = await completeEmail({
          email: normalizedEmail,
          purpose,
          verificationToken: grant,
          password,
          remember,
          kvkkAccepted: consent,
        });
        if (result.reset) {
          setGrant('');
          setCode('');
          setPassword('');
          setStep('password');
          setMessage(
            en
              ? 'Password updated. Sign in with your new password.'
              : 'Şifren yenilendi. Yeni şifrenle giriş yapabilirsin.',
          );
        } else onClose();
      }
    });
  }
  const caption =
    step === 'options'
      ? en
        ? 'Your favourites and preferences. All at one table.'
        : 'Favorilerin, tercihlerin, sana özel bir deneyim.'
      : step === 'email'
        ? en
          ? 'One email. Your place at every table.'
          : 'Bir e-posta ile tüm sofralarda yerin hazır.'
        : step === 'password'
          ? en
            ? 'Your account is ready. Enter your password.'
            : 'Hesabını bulduk. Şifrenle devam edebilirsin.'
          : step === 'code'
            ? en
              ? 'Enter the 6-digit code we sent. It is valid for 5 minutes.'
              : 'E-postana gönderdiğimiz 6 haneli kodu gir. Kod 5 dakika geçerli.'
            : purpose === 'reset'
              ? en
                ? 'A fresh password for your next visit.'
                : 'Hesabına yeni bir şifreyle devam et.'
              : en
                ? 'One last step. Choose your password.'
                : 'Son bir adım. Sana özel bir şifre seç.';

  return createPortal(
    <div
      className="customer-entry"
      role="dialog"
      aria-modal="true"
      aria-labelledby={id}
    >
      <button
        type="button"
        className="customer-entry__shade"
        onClick={onClose}
        aria-label={en ? 'Close' : 'Kapat'}
        tabIndex={-1}
      />
      <section className="customer-entry__panel" ref={panel} tabIndex={-1}>
        <button
          type="button"
          className="customer-entry__close"
          onClick={onClose}
          aria-label={en ? 'Close' : 'Kapat'}
        >
          <X size={22} />
        </button>
        <aside className="customer-entry__invitation" aria-hidden="true">
          <span className="customer-entry__brand">
            <Utensils size={19} />
            {restaurantName || 'Menü QR'}
          </span>
          <div className="customer-entry__welcome">
            <span>
              {en ? 'YOUR PLACE AT THE TABLE' : 'BU SOFRADA YERİN VAR'}
            </span>
            <p>
              {en ? (
                <>
                  A little more
                  <br />
                  <i>you.</i>
                </>
              ) : (
                <>
                  Biraz daha
                  <br />
                  <i>sen.</i>
                </>
              )}
            </p>
          </div>
          <div className="customer-entry__pass">
            <span className="customer-entry__pass-notch" />
            <div className="customer-entry__pass-top">
              <Utensils size={23} />
              <Sparkles size={22} />
            </div>
            <small>{en ? 'YOUR MENU ACCOUNT' : 'SANA ÖZEL MENÜ HESABI'}</small>
            <strong>
              {en ? 'Welcome to\nthe table.' : 'Sofraya\nhoş geldin.'}
            </strong>
            <div className="customer-entry__pass-bottom">
              <span>
                MENU CLUB
                <br />
                <b>01 / ∞</b>
              </span>
              <QrCode size={48} />
            </div>
          </div>
          <span className="customer-entry__invitation-foot">
            {en
              ? 'Good moments start at the table.'
              : 'Güzel anlar sofrada başlar.'}
          </span>
        </aside>
        <div className="customer-entry__content">
          <header className="customer-entry__mobile-brand">
            <Utensils size={19} />
            <span>{restaurantName || 'Menü QR'}</span>
          </header>
          <div key={step} className="customer-entry__step">
            {step !== 'options' && (
              <button
                type="button"
                className="customer-entry__back"
                onClick={back}
                disabled={busy}
              >
                <ArrowLeft size={17} />
                {en ? 'Back' : 'Geri'}
              </button>
            )}
            <span className="customer-entry__eyebrow">
              {step === 'options'
                ? en
                  ? 'YOUR MENU ACCOUNT'
                  : 'MENÜ HESABIN'
                : step === 'create'
                  ? en
                    ? 'ALMOST THERE'
                    : 'AZ KALDI'
                  : en
                    ? 'A SMALL STEP'
                    : 'KÜÇÜK BİR ADIM'}
            </span>
            <h2 id={id}>{titles[step]}</h2>
            <p className="customer-entry__caption">{caption}</p>
            {step !== 'options' && step !== 'email' && (
              <button
                type="button"
                className="customer-entry__email"
                onClick={back}
                disabled={busy}
              >
                <Mail size={15} />
                <span>{normalizedEmail}</span>
                <ArrowLeft size={13} />
              </button>
            )}
            {error && (
              <p className="customer-entry__error" role="alert">
                {error}
              </p>
            )}
            {message && (
              <p className="customer-entry__success" role="status">
                <Check size={17} />
                {message}
              </p>
            )}
            {step === 'options' ? (
              <div className="customer-entry__options">
                <button
                  type="button"
                  className="customer-entry__google"
                  disabled
                  aria-describedby={`${id}-google`}
                >
                  <span className="customer-entry__google-mark">G</span>
                  {en ? 'Continue with Google' : 'Google ile Devam Et'}
                  <small>{en ? 'Soon' : 'Yakında'}</small>
                </button>
                <p id={`${id}-google`} className="customer-entry__google-note">
                  {en
                    ? 'Google sign-in is not enabled yet.'
                    : 'Google ile giriş şimdilik kapalı.'}
                </p>
                <span className="customer-entry__or">{en ? 'or' : 'veya'}</span>
                <button
                  type="button"
                  className="customer-entry__primary"
                  onClick={() => setStep('email')}
                >
                  <Mail size={19} />
                  {en ? 'Continue with email' : 'E-posta ile Devam Et'}
                  <ArrowRight size={19} />
                </button>
              </div>
            ) : (
              <form
                onSubmit={(event) => void submit(event)}
                className="customer-entry__form"
              >
                {step === 'email' && (
                  <label className="customer-entry__field">
                    <span>{en ? 'Email address' : 'E-posta adresin'}</span>
                    <input
                      ref={input}
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      inputMode="email"
                      autoCapitalize="none"
                      spellCheck={false}
                      maxLength={150}
                      placeholder="sen@ornek.com"
                      required
                      disabled={busy}
                    />
                  </label>
                )}
                {step === 'code' && (
                  <>
                    <label className="customer-entry__code">
                      <span className="customer-entry__sr-only">
                        {en
                          ? '6-digit verification code'
                          : '6 haneli doğrulama kodu'}
                      </span>
                      <input
                        ref={input}
                        value={code}
                        onChange={(e) =>
                          setCode(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        onPaste={(event) => {
                          event.preventDefault();
                          setCode(
                            event.clipboardData
                              .getData('text')
                              .slice(0, 128)
                              .replace(/\D/g, '')
                              .slice(0, 6),
                          );
                        }}
                        pattern="[0-9]{6}"
                        maxLength={6}
                        required
                        disabled={busy}
                      />
                      <span
                        className="customer-entry__digits"
                        aria-hidden="true"
                      >
                        {Array.from({ length: 6 }, (_, i) => (
                          <span
                            key={i}
                            className={code.length === i ? 'is-current' : ''}
                          >
                            {code[i] || ''}
                          </span>
                        ))}
                      </span>
                    </label>
                    <button
                      type="button"
                      className="customer-entry__resend"
                      disabled={busy || remaining > 0}
                      onClick={() =>
                        void run(async () =>
                          receive(
                            await customerEmailRequest<EmailChallenge>('code', {
                              email: normalizedEmail,
                              purpose,
                            }),
                            purpose,
                          ),
                        )
                      }
                    >
                      {remaining > 0
                        ? en
                          ? `Resend in ${remaining}s`
                          : `${remaining} sn sonra yeniden gönder`
                        : en
                          ? 'Send a new code'
                          : 'Kodu yeniden gönder'}
                    </button>
                  </>
                )}
                {(step === 'password' || step === 'create') && (
                  <>
                    <label className="customer-entry__field">
                      <span>
                        {step === 'create'
                          ? en
                            ? 'Your new password'
                            : 'Yeni şifren'
                          : en
                            ? 'Password'
                            : 'Şifren'}
                      </span>
                      <span className="customer-entry__password">
                        <input
                          ref={input}
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          autoComplete={
                            step === 'create'
                              ? 'new-password'
                              : 'current-password'
                          }
                          minLength={step === 'create' ? 8 : undefined}
                          maxLength={72}
                          required
                          disabled={busy}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          aria-label={
                            showPassword
                              ? en
                                ? 'Hide password'
                                : 'Şifreyi gizle'
                              : en
                                ? 'Show password'
                                : 'Şifreyi göster'
                          }
                        >
                          {showPassword ? (
                            <EyeOff size={19} />
                          ) : (
                            <Eye size={19} />
                          )}
                        </button>
                      </span>
                    </label>
                    {step === 'create' && (
                      <p className="customer-entry__password-hint">
                        <LockKeyhole size={13} />
                        {en ? 'At least 8 characters.' : 'En az 8 karakter.'}
                      </p>
                    )}
                    {step === 'password' && (
                      <button
                        type="button"
                        className="customer-entry__forgot"
                        disabled={busy}
                        onClick={() =>
                          void run(async () =>
                            receive(
                              await customerEmailRequest<EmailChallenge>(
                                'code',
                                { email: normalizedEmail, purpose: 'reset' },
                              ),
                              'reset',
                            ),
                          )
                        }
                      >
                        {en ? 'Forgot password?' : 'Şifremi unuttum'}
                      </button>
                    )}
                    <label className="customer-entry__check">
                      <input
                        type="checkbox"
                        checked={remember}
                        onChange={(e) => setRemember(e.target.checked)}
                        disabled={busy}
                      />
                      <span>{en ? 'Remember me' : 'Beni hatırla'}</span>
                    </label>
                    {step === 'create' && purpose === 'register' && (
                      <label className="customer-entry__check customer-entry__consent">
                        <input
                          type="checkbox"
                          checked={consent}
                          onChange={(e) => setConsent(e.target.checked)}
                          required
                          disabled={busy}
                        />
                        <span>
                          {en
                            ? 'I consent to processing my personal data, including allergy and preference data, under KVKK.'
                            : 'Kişisel verilerimin (alerji/tercih dahil) işlenmesini KVKK kapsamında kabul ediyorum.'}
                        </span>
                      </label>
                    )}
                  </>
                )}
                <button
                  type="submit"
                  className="customer-entry__primary"
                  disabled={busy || (step === 'code' && code.length !== 6)}
                >
                  {busy
                    ? en
                      ? 'One moment…'
                      : 'Bir saniye…'
                    : step === 'password'
                      ? en
                        ? 'Sign in'
                        : 'Giriş yap'
                      : step === 'code'
                        ? en
                          ? 'Verify code'
                          : 'Kodu doğrula'
                        : step === 'create'
                          ? purpose === 'reset'
                            ? en
                              ? 'Update password'
                              : 'Şifremi yenile'
                            : en
                              ? 'Create my account'
                              : 'Hesabımı oluştur'
                          : en
                            ? 'Continue'
                            : 'Devam et'}
                  <ArrowRight size={19} />
                </button>
              </form>
            )}
          </div>
          <footer className="customer-entry__footer">
            <ShieldCheck size={16} />
            <span>
              {en ? 'One account. Every table.' : 'Tek hesap. Bütün sofralar.'}
            </span>
          </footer>
        </div>
      </section>
    </div>,
    document.body,
  );
}

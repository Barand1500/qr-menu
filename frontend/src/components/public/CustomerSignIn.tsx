import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  EyeOff,
  LockKeyhole,
  Mail,
  ShieldCheck,
  TriangleAlert,
  Utensils,
  X,
} from 'lucide-react';
import { imageUrl } from '@/lib/api';
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
  logoUrl,
  photos = [],
  lang = 'tr',
}: {
  onClose: () => void;
  restaurantName?: string;
  logoUrl?: string | null;
  /** The business's own photos (up to three), shown as a fan next to the form. */
  photos?: string[];
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
        options: 'Join the\ntable.',
        email: 'What’s your\nemail?',
        password: 'Welcome\nback.',
        code: 'Check your\ninbox.',
        create: 'Set your\npassword.',
      }
    : {
        options: 'Sofraya\nkatıl.',
        email: 'E-postan\nneydi?',
        password: 'Tekrar\nhoş geldin.',
        code: 'Gelen kutuna\nbak.',
        create: 'Şifreni\nbelirle.',
      };
  const eyebrows = en
    ? {
        options: 'SIGN IN OR JOIN',
        email: 'EMAIL',
        password: 'SIGN IN',
        code: 'VERIFICATION',
        create: purpose === 'reset' ? 'NEW PASSWORD' : 'LAST STEP',
      }
    : {
        options: 'GİRİŞ YAP YA DA KAYIT OL',
        email: 'E-POSTA',
        password: 'GİRİŞ',
        code: 'DOĞRULAMA',
        create: purpose === 'reset' ? 'YENİ ŞİFRE' : 'SON ADIM',
      };
  const fan = photos.slice(0, 3).map((src) => imageUrl(src));

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
        ? 'Your favourites, preferences and allergy notes follow you to every table.'
        : 'Favorilerin, tercihlerin ve alerji bilgin her sofrada seninle.'
      : step === 'email'
        ? en
          ? 'One email is all it takes. We’ll find your account or start one.'
          : 'Tek bir e-posta yeter. Hesabını bulur ya da yenisini açarız.'
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

  // The photo with the most weight sits in the middle of the fan.
  const ordered = fan.length === 3 ? [fan[1], fan[0], fan[2]] : fan;
  const cards = ordered.map((src, i) => {
    const k = i - (ordered.length - 1) / 2;
    return (
      <figure
        key={src}
        style={
          {
            '--k': k,
            '--ak': Math.abs(k),
            '--i': i,
            zIndex: 5 - Math.round(Math.abs(k) * 2),
          } as CSSProperties
        }
      >
        <img src={src} alt="" loading="eager" draggable={false} />
      </figure>
    );
  });
  const lines = titles[step].split('\n');
  const label =
    step === 'password'
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
            : 'Devam et';

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
        <aside className="customer-entry__invitation" aria-hidden="true">
          <i className="customer-entry__glow" />
          <i className="customer-entry__glow customer-entry__glow--b" />
          {cards.length ? (
            <div className="customer-entry__fan" data-count={cards.length}>
              {cards}
            </div>
          ) : (
            <div className="customer-entry__ghost">
              <span>
                {Array.from(
                  { length: 4 },
                  () => `${restaurantName || 'Menü QR'} ✦`,
                ).join(' ')}
              </span>
            </div>
          )}
          <p className="customer-entry__invitation-foot">
            {en
              ? 'Good moments start at the table.'
              : 'Güzel anlar sofrada başlar.'}
          </p>
        </aside>
        <div className="customer-entry__content">
          <header className="customer-entry__head">
            <span className="customer-entry__badge">
              {logoUrl ? (
                <img src={imageUrl(logoUrl)} alt="" />
              ) : (
                <Utensils size={21} />
              )}
            </span>
            <span className="customer-entry__head-copy">
              <small>{en ? 'MENU ACCOUNT' : 'MENÜ HESABI'}</small>
              <strong>{restaurantName || 'Menü QR'}</strong>
            </span>
            <button
              type="button"
              className="customer-entry__close"
              onClick={onClose}
              aria-label={en ? 'Close' : 'Kapat'}
            >
              <X size={22} />
            </button>
          </header>
          <div className="customer-entry__scroll">
            <div key={step} className="customer-entry__step">
              {step === 'options' && cards.length > 0 && (
                <div className="customer-entry__stack" aria-hidden="true">
                  {cards}
                </div>
              )}
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
              <span className="customer-entry__eyebrow">{eyebrows[step]}</span>
              <h2
                id={id}
                aria-label={lines.join(' ')}
                className={
                  ['options', 'email', 'password'].includes(step)
                    ? 'customer-entry__title--inline'
                    : undefined
                }
              >
                {lines.map((line, i) => (
                  <span className="customer-entry__line" key={i} aria-hidden="true">
                    <span
                      className={i === lines.length - 1 ? 'is-accent' : undefined}
                      style={{ '--i': i } as CSSProperties}
                    >
                      {line}
                    </span>
                  </span>
                ))}
              </h2>
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
                  <TriangleAlert size={17} />
                  <span>{error}</span>
                </p>
              )}
              {message && (
                <p className="customer-entry__success" role="status">
                  <Check size={17} />
                  <span>{message}</span>
                </p>
              )}
              {step === 'options' ? (
                <div className="customer-entry__options">
                  <button
                    type="button"
                    className="customer-entry__primary"
                    onClick={() => setStep('email')}
                  >
                    <span className="customer-entry__label">
                      <Mail size={19} />
                      {en ? 'Continue with email' : 'E-posta ile Devam Et'}
                    </span>
                    <span className="customer-entry__orb">
                      <ArrowRight size={20} />
                    </span>
                  </button>
                  <span className="customer-entry__or">{en ? 'or' : 'veya'}</span>
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
                  <p id={`${id}-google`} className="customer-entry__sr-only">
                    {en
                      ? 'Google sign-in is not enabled yet.'
                      : 'Google ile giriş şimdilik kapalı.'}
                  </p>
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
                              className={
                                code.length === i
                                  ? 'is-current'
                                  : code[i]
                                    ? 'is-filled'
                                    : ''
                              }
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
                    <span className="customer-entry__label">
                      {busy ? (en ? 'One moment…' : 'Bir saniye…') : label}
                    </span>
                    <span className="customer-entry__orb">
                      {busy ? (
                        <span className="customer-entry__spinner" />
                      ) : (
                        <ArrowRight size={20} />
                      )}
                    </span>
                  </button>
                </form>
              )}
            </div>
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

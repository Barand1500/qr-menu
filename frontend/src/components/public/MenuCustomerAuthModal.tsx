import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Heart,
  KeyRound,
  LogOut,
  Sparkles,
  ThumbsDown,
  UserRound,
  Wine,
  X,
} from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
} from '@/lib/dietAllergens';

type Mode = 'login' | 'register' | 'profile';
type LoginType = 'email' | 'phone';
type AlcoholPref = 'yes' | 'no' | 'unset';

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId?: number | null;
  restaurantName?: string;
  lang?: string;
};

/** TR cep: 5XX XXX XX XX (10 hane) */
function formatPhoneInput(raw: string) {
  let d = raw.replace(/\D/g, '');
  if (d.startsWith('90') && d.length > 10) d = d.slice(2);
  if (d.startsWith('0')) d = d.slice(1);
  d = d.slice(0, 10);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0, 3)} ${d.slice(3)}`;
  if (d.length <= 8) return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6)}`;
  return `${d.slice(0, 3)} ${d.slice(3, 6)} ${d.slice(6, 8)} ${d.slice(8)}`;
}

function ChipEditor({
  label,
  hint,
  values,
  onChange,
  placeholder,
  tone = 'like',
}: {
  label: string;
  hint?: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone?: 'like' | 'dislike';
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.some((x) => x.toLocaleLowerCase('tr-TR') === v.toLocaleLowerCase('tr-TR'))) {
      setDraft('');
      return;
    }
    onChange([...values, v].slice(0, 40));
    setDraft('');
  }
  return (
    <section className={`mc-auth__block mc-auth__block--${tone}`}>
      <div className="mc-auth__block-head">
        {tone === 'like' ? <Heart className="w-4 h-4" /> : <ThumbsDown className="w-4 h-4" />}
        <div>
          <h3>{label}</h3>
          {hint ? <p>{hint}</p> : null}
        </div>
      </div>
      <div className="mc-auth__chips">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className={`mc-auth__chip is-on tone-${tone}`}
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            {v}
            <X className="w-3 h-3" />
          </button>
        ))}
      </div>
      <div className="mc-auth__chip-add">
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          Ekle
        </button>
      </div>
    </section>
  );
}

export default function MenuCustomerAuthModal({
  open,
  onClose,
  restaurantId,
  restaurantName,
  lang = 'tr',
}: Props) {
  const {
    customer,
    login,
    register,
    logout,
    updateProfile,
    refresh,
    restaurantPoints,
    filterEnabled,
    setFilterEnabled,
  } = useCustomerAuth();

  const [mode, setMode] = useState<Mode>('login');
  const [loginType, setLoginType] = useState<LoginType>('phone');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [remember, setRemember] = useState(true);
  const [kvkk, setKvkk] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [savedFlash, setSavedFlash] = useState(false);

  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [alcohol, setAlcohol] = useState<AlcoholPref>('unset');
  const [profileName, setProfileName] = useState('');

  const points = restaurantPoints(restaurantId);
  const firstName = (customer?.fullName || profileName || '').trim().split(/\s+/)[0] || 'Misafir';

  useEffect(() => {
    if (!open) return;
    setError('');
    setPassword('');
    setSavedFlash(false);
    if (customer) setMode('profile');
    else {
      setMode('login');
      setKvkk(false);
    }
  }, [open, customer?.id]);

  useEffect(() => {
    if (!open || !customer) return;
    setProfileName(customer.fullName);
    setAllergens(customer.allergenTags || []);
    setDiets(customer.dietTags || []);
    setLiked(customer.likedFoods || []);
    setDisliked(customer.dislikedFoods || []);
    setAlcohol(
      customer.drinksAlcohol === true ? 'yes' : customer.drinksAlcohol === false ? 'no' : 'unset'
    );
  }, [open, customer?.id]);

  useEffect(() => {
    if (!open || !customer?.id || !restaurantId) return;
    void refresh(restaurantId).catch(() => undefined);
  }, [open, customer?.id, restaurantId, refresh]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const title = useMemo(() => {
    if (mode === 'profile') return 'Profilim';
    if (mode === 'register') return 'Kayıt ol';
    return 'Giriş yap';
  }, [mode]);

  if (!open) return null;

  async function submitAuth(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const body: Record<string, unknown> = {
        loginType,
        password,
        remember,
        email: loginType === 'email' ? email.trim() : undefined,
        phone: loginType === 'phone' ? phone : undefined,
      };
      if (mode === 'register') {
        body.fullName = fullName.trim();
        body.kvkkAccepted = kvkk;
        await register(body);
      } else {
        await login(body);
      }
      if (restaurantId) await refresh(restaurantId);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İşlem başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        fullName: profileName.trim(),
        allergenTags: allergens,
        dietTags: diets,
        likedFoods: liked,
        dislikedFoods: disliked,
        drinksAlcohol: alcohol === 'yes' ? true : alcohol === 'no' ? false : null,
      });
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1600);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className={`mc-auth${mode === 'profile' ? ' mc-auth--profile' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="mc-auth-title"
    >
      <button type="button" className="mc-auth__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="mc-auth__panel">
        <header className="mc-auth__head">
          <div className="mc-auth__head-icon">
            {mode === 'profile' ? <Sparkles className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mc-auth__eyebrow">
              {mode === 'profile' ? `Merhaba ${firstName}` : 'QR Menü hesabı'}
            </p>
            <h2 id="mc-auth-title">{title}</h2>
            <p>
              {mode === 'profile'
                ? restaurantName
                  ? `${restaurantName}`
                  : 'Tercihlerin tüm restoranlarda geçerli'
                : 'Bir kez kayıt ol, tüm menülerimizde kullan.'}
            </p>
          </div>
          <button type="button" className="mc-auth__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="mc-auth__body">
          {error ? <div className="mc-auth__error">{error}</div> : null}
          {savedFlash ? (
            <div className="mc-auth__ok">
              <Check className="w-4 h-4" />
              Profil kaydedildi
            </div>
          ) : null}

          {mode !== 'profile' ? (
            <form className="mc-auth__form" onSubmit={(e) => void submitAuth(e)}>
              <div className="mc-auth__tabs" role="tablist">
                <button
                  type="button"
                  className={mode === 'login' ? 'is-active' : ''}
                  onClick={() => setMode('login')}
                >
                  Giriş
                </button>
                <button
                  type="button"
                  className={mode === 'register' ? 'is-active' : ''}
                  onClick={() => setMode('register')}
                >
                  Kayıt
                </button>
              </div>

              <div className="mc-auth__tabs mc-auth__tabs--soft" role="tablist">
                <button
                  type="button"
                  className={loginType === 'phone' ? 'is-active' : ''}
                  onClick={() => setLoginType('phone')}
                >
                  Telefon
                </button>
                <button
                  type="button"
                  className={loginType === 'email' ? 'is-active' : ''}
                  onClick={() => setLoginType('email')}
                >
                  E-posta
                </button>
              </div>

              {mode === 'register' ? (
                <div className="mc-auth__field">
                  <label htmlFor="mc-name">Ad soyad</label>
                  <input
                    id="mc-name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              ) : null}

              {loginType === 'email' ? (
                <div className="mc-auth__field">
                  <label htmlFor="mc-email">E-posta</label>
                  <input
                    id="mc-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                    placeholder="ornek@mail.com"
                  />
                </div>
              ) : (
                <div className="mc-auth__field">
                  <label htmlFor="mc-phone">Cep telefonu</label>
                  <input
                    id="mc-phone"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(formatPhoneInput(e.target.value))}
                    required
                    autoComplete="tel"
                    placeholder="5XX XXX XX XX"
                  />
                </div>
              )}

              <div className="mc-auth__field">
                <label htmlFor="mc-pass">Şifre</label>
                <input
                  id="mc-pass"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
                />
              </div>

              <label className="mc-auth__check">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Beni hatırla</span>
              </label>

              {mode === 'register' ? (
                <label className="mc-auth__check mc-auth__check--kvkk">
                  <input
                    type="checkbox"
                    checked={kvkk}
                    onChange={(e) => setKvkk(e.target.checked)}
                    required
                  />
                  <span>
                    Kişisel verilerimin (alerji/tercih dahil) işlenmesini KVKK kapsamında
                    kabul ediyorum.
                  </span>
                </label>
              ) : null}

              <button type="submit" className="mc-auth__primary" disabled={busy}>
                {busy ? 'Lütfen bekleyin…' : mode === 'register' ? 'Kayıt ol' : 'Giriş yap'}
              </button>
            </form>
          ) : (
            <form className="mc-auth__form mc-auth__form--profile" onSubmit={(e) => void saveProfile(e)}>
              <div className="mc-auth__hero">
                <div className="mc-auth__avatar">
                  <UserRound className="w-6 h-6" />
                </div>
                <div className="min-w-0">
                  <strong>{customer?.fullName}</strong>
                  <span>
                    {customer?.phone
                      ? formatPhoneInput(customer.phone)
                      : customer?.email || 'Hesap'}
                  </span>
                </div>
                <div className="mc-auth__points">
                  <em>Puan</em>
                  <b>{points}</b>
                </div>
              </div>

              <label className="mc-auth__switch">
                <span>
                  <strong>Kişisel menü filtresi</strong>
                  <small>Açıkken alerji, alkol ve sevmediklerin uygulanır</small>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={filterEnabled}
                  className={`mc-auth__switch-ui${filterEnabled ? ' is-on' : ''}`}
                  onClick={() => setFilterEnabled(!filterEnabled)}
                >
                  <i />
                </button>
              </label>

              <div className="mc-auth__field">
                <label htmlFor="mc-pname">Ad soyad</label>
                <input
                  id="mc-pname"
                  value={profileName}
                  onChange={(e) => setProfileName(e.target.value)}
                  required
                />
              </div>

              <section className="mc-auth__block">
                <div className="mc-auth__block-head">
                  <Wine className="w-4 h-4" />
                  <div>
                    <h3>Alkol</h3>
                    <p>Restoranlarda alkol içeren ürünler için tercih</p>
                  </div>
                </div>
                <div className="mc-auth__alcohol">
                  <button
                    type="button"
                    className={alcohol === 'yes' ? 'is-active' : ''}
                    onClick={() => setAlcohol('yes')}
                  >
                    Alkol tüketiyorum
                  </button>
                  <button
                    type="button"
                    className={alcohol === 'no' ? 'is-active is-no' : ''}
                    onClick={() => setAlcohol('no')}
                  >
                    Alkol tüketmiyorum
                  </button>
                </div>
              </section>

              <section className="mc-auth__block">
                <div className="mc-auth__block-head">
                  <Sparkles className="w-4 h-4" />
                  <div>
                    <h3>Alerjiler</h3>
                    <p>Seçtiklerin menüden gizlenir</p>
                  </div>
                </div>
                <div className="mc-auth__chips">
                  {ALLERGEN_CATALOG.map((a) => {
                    const on = allergens.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`mc-auth__chip${on ? ' is-on' : ''}`}
                        onClick={() =>
                          setAllergens((prev) =>
                            on ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                          )
                        }
                      >
                        {allergenLabel(a.id, lang)}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section className="mc-auth__block">
                <div className="mc-auth__block-head">
                  <Sparkles className="w-4 h-4" />
                  <div>
                    <h3>Diyet / tercih</h3>
                    <p>Uygun ürünler öne çıkar</p>
                  </div>
                </div>
                <div className="mc-auth__chips">
                  {DIET_CATALOG.map((d) => {
                    const on = diets.includes(d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        className={`mc-auth__chip${on ? ' is-on' : ''}`}
                        onClick={() =>
                          setDiets((prev) =>
                            on ? prev.filter((x) => x !== d.id) : [...prev, d.id]
                          )
                        }
                      >
                        {dietLabel(d.id, lang)}
                      </button>
                    );
                  })}
                </div>
              </section>

              <ChipEditor
                label="Sevdiğim yemekler"
                hint="İsim veya kategori yaz (ör. pizza, tatlı)"
                values={liked}
                onChange={setLiked}
                placeholder="Örn. pizza"
                tone="like"
              />
              <ChipEditor
                label="Sevmediğim yemekler"
                hint="Büyük/küçük harf fark etmez; ürün adında geçerse gizlenir"
                values={disliked}
                onChange={setDisliked}
                placeholder="Örn. soğan"
                tone="dislike"
              />

              <div className="mc-auth__footer">
                <button type="submit" className="mc-auth__primary" disabled={busy}>
                  {busy ? 'Kaydediliyor…' : 'Kaydet'}
                </button>
                <button
                  type="button"
                  className="mc-auth__ghost"
                  onClick={() => {
                    logout();
                    onClose();
                  }}
                >
                  <LogOut className="w-4 h-4" />
                  Çıkış yap
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

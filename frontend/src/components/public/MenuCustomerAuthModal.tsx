import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Gift,
  Heart,
  KeyRound,
  LogOut,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  UserRound,
  Wine,
  X,
  ArrowLeft,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
} from '@/lib/dietAllergens';
import { customerProfileUi } from '@/lib/customerProfileUi';
import {
  CUSTOMER_QR_TTL_MS,
  makeCustomerQrPreviewPayload,
  readCustomerPrivacy,
  writeCustomerPrivacy,
  type CustomerPrivacyFlags,
} from '@/lib/customerQrPreview';

type Mode = 'login' | 'register' | 'profile';
type ProfilePane = 'home' | 'perks';
type MobileTab = 'qr' | 'info' | 'prefs';
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
  const [profilePane, setProfilePane] = useState<ProfilePane>('home');
  const [mobileTab, setMobileTab] = useState<MobileTab>('qr');
  const [privacy, setPrivacy] = useState<CustomerPrivacyFlags>({
    showName: true,
    showPhone: true,
    showEmail: true,
  });
  const [qrPayload, setQrPayload] = useState('');
  const [qrExpiresAt, setQrExpiresAt] = useState(0);
  const [qrNow, setQrNow] = useState(() => Date.now());

  const points = restaurantPoints(restaurantId);
  const firstName = (customer?.fullName || profileName || '').trim().split(/\s+/)[0] || 'Misafir';
  const pointsEntries = useMemo(() => {
    const map = customer?.pointsByRestaurant || {};
    return Object.entries(map)
      .map(([id, pts]) => ({
        id,
        points: Number(pts) || 0,
        label:
          restaurantId && String(restaurantId) === id && restaurantName
            ? restaurantName
            : `Restoran #${id}`,
        isCurrent: restaurantId != null && String(restaurantId) === id,
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent) || b.points - a.points);
  }, [customer?.pointsByRestaurant, restaurantId, restaurantName]);

  function rotateQr(customerId: number) {
    setQrPayload(makeCustomerQrPreviewPayload(customerId));
    setQrExpiresAt(Date.now() + CUSTOMER_QR_TTL_MS);
  }

  function patchPrivacy(patch: Partial<CustomerPrivacyFlags>) {
    if (!customer) return;
    setPrivacy((prev) => {
      const next = { ...prev, ...patch };
      writeCustomerPrivacy(customer.id, next);
      return next;
    });
  }

  useEffect(() => {
    if (!open) return;
    setError('');
    setPassword('');
    setSavedFlash(false);
    setProfilePane('home');
    setMobileTab('qr');
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
    setPrivacy(readCustomerPrivacy(customer.id));
    rotateQr(customer.id);
  }, [open, customer?.id]);

  useEffect(() => {
    if (!open || mode !== 'profile' || !customer) return;
    const tick = window.setInterval(() => {
      const now = Date.now();
      setQrNow(now);
      if (now >= qrExpiresAt) rotateQr(customer.id);
    }, 500);
    return () => window.clearInterval(tick);
  }, [open, mode, customer?.id, qrExpiresAt]);

  useEffect(() => {
    if (!open || !customer?.id || !restaurantId) return;
    void refresh(restaurantId).catch(() => undefined);
  }, [open, customer?.id, restaurantId, refresh]);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (profilePane === 'perks') setProfilePane('home');
        else onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose, profilePane]);

  const ui = customerProfileUi(lang || 'tr');

  const title = useMemo(() => {
    if (mode === 'profile') return ui.myProfile;
    if (mode === 'register') return ui.register;
    return ui.login;
  }, [mode, ui.login, ui.myProfile, ui.register]);

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
      <button type="button" className="mc-auth__scrim" aria-label={ui.close} onClick={onClose} />
      <div className="mc-auth__panel">
        <header className="mc-auth__head">
          <div className="mc-auth__head-icon">
            {mode === 'profile' ? <Sparkles className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <p className="mc-auth__eyebrow">
              {mode === 'profile'
                ? profilePane === 'perks'
                  ? 'Avantajlar'
                  : `Merhaba ${firstName}`
                : 'QR Menü hesabı'}
            </p>
            <h2 id="mc-auth-title">
              {mode === 'profile' && profilePane === 'perks' ? 'Size özel' : title}
            </h2>
            <p>
              {mode === 'profile'
                ? profilePane === 'perks'
                  ? 'Puan, indirim ve borç özeti'
                  : restaurantName
                    ? `${restaurantName}`
                    : 'Tercihlerin tüm restoranlarda geçerli'
                : 'Bir kez kayıt ol, tüm menülerimizde kullan.'}
            </p>
          </div>
          {mode === 'profile' && profilePane === 'perks' ? (
            <button
              type="button"
              className="mc-auth__close"
              onClick={() => setProfilePane('home')}
              aria-label="Geri"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          ) : (
            <button type="button" className="mc-auth__close" onClick={onClose} aria-label={ui.close}>
              <X className="w-5 h-5" />
            </button>
          )}
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
          ) : profilePane === 'perks' ? (
            <div className="mc-perks">
              <section className="mc-perks__card">
                <header>
                  <h3>Puanlar</h3>
                  <p>Tüm restoranlardaki puanların</p>
                </header>
                {pointsEntries.length === 0 ? (
                  <p className="mc-perks__empty">Henüz puan yok.</p>
                ) : (
                  <ul className="mc-perks__list">
                    {pointsEntries.map((row) => (
                      <li key={row.id}>
                        <div>
                          <strong>{row.label}</strong>
                          {row.isCurrent ? <em>Şu an</em> : null}
                        </div>
                        <b>{row.points}</b>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="mc-perks__card">
                <header>
                  <h3>Özel indirimler</h3>
                  <p>Sana tanımlanan indirimler burada görünecek</p>
                </header>
                <p className="mc-perks__empty">Şimdilik özel indirim yok.</p>
              </section>

              <section className="mc-perks__card">
                <header>
                  <h3>Borç / bakiye</h3>
                  <p>Restoran hesapları burada toplanacak</p>
                </header>
                <p className="mc-perks__empty">Görüntülenecek borç yok.</p>
              </section>
            </div>
          ) : (
            <form className="mc-auth__form mc-auth__form--profile" onSubmit={(e) => void saveProfile(e)}>
              <div className="mc-profile">
                <button
                  type="button"
                  className="mc-profile__perks-btn"
                  onClick={() => setProfilePane('perks')}
                >
                  <Gift className="w-4 h-4" />
                  <span>Size özel indirimler</span>
                  <em>{points > 0 ? `${points} puan` : 'Puan & borç'}</em>
                </button>

                <div className={`mc-profile__stage${mobileTab !== 'qr' ? ' is-mobile-away' : ''}`}>
                  <div className="mc-profile__qr-card">
                    <div className="mc-profile__qr-frame">
                      {qrPayload ? (
                        <QRCodeSVG
                          value={qrPayload}
                          size={168}
                          level="M"
                          includeMargin={false}
                          bgColor="#ffffff"
                          fgColor="#0f172a"
                        />
                      ) : null}
                    </div>
                    <p className="mc-profile__qr-caption">Kişisel kodun</p>
                    <p className="mc-profile__qr-hint">
                      Garson / kasa bu kodu okutunca müşteri kartın açılır
                    </p>
                    <div className="mc-profile__qr-meta">
                      <span>
                        {Math.max(0, Math.ceil((qrExpiresAt - qrNow) / 1000))} sn
                      </span>
                      <button
                        type="button"
                        className="mc-profile__qr-refresh"
                        onClick={() => customer && rotateQr(customer.id)}
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        Yenile
                      </button>
                    </div>
                    <div
                      className="mc-profile__qr-bar"
                      style={{
                        width: `${Math.max(
                          0,
                          Math.min(100, ((qrExpiresAt - qrNow) / CUSTOMER_QR_TTL_MS) * 100)
                        )}%`,
                      }}
                    />
                  </div>
                </div>

                <nav className="mc-profile__tabs" aria-label="Profil bölümleri">
                  <button
                    type="button"
                    className={mobileTab === 'qr' ? 'is-active' : ''}
                    onClick={() => setMobileTab('qr')}
                  >
                    QR
                  </button>
                  <button
                    type="button"
                    className={mobileTab === 'info' ? 'is-active' : ''}
                    onClick={() => setMobileTab('info')}
                  >
                    Bilgi
                  </button>
                  <button
                    type="button"
                    className={mobileTab === 'prefs' ? 'is-active' : ''}
                    onClick={() => setMobileTab('prefs')}
                  >
                    Tercihler
                  </button>
                </nav>

                <div
                  className={`mc-profile__col mc-profile__col--info${
                    mobileTab === 'info' ? ' is-mobile-on' : ' is-mobile-away'
                  }`}
                >
                  <section className="mc-profile__panel">
                    <header className="mc-profile__panel-head">
                      <UserRound className="w-4 h-4" />
                      <div>
                        <h3>İletişim</h3>
                        <p>Restoranların görebileceği bilgileri seç</p>
                      </div>
                    </header>

                    <div className="mc-auth__field">
                      <div className="mc-profile__field-row">
                        <label htmlFor="mc-pname">{ui.fullName}</label>
                        <button
                          type="button"
                          className={`mc-profile__eye${privacy.showName ? ' is-on' : ''}`}
                          onClick={() => patchPrivacy({ showName: !privacy.showName })}
                          title={privacy.showName ? 'Restoranlar görür' : 'Gizli'}
                        >
                          {privacy.showName ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {privacy.showName ? 'Görünür' : 'Gizli'}
                        </button>
                      </div>
                      <input
                        id="mc-pname"
                        value={profileName}
                        onChange={(e) => setProfileName(e.target.value)}
                        required
                      />
                    </div>

                    <div className="mc-auth__field">
                      <div className="mc-profile__field-row">
                        <label>Telefon</label>
                        <button
                          type="button"
                          className={`mc-profile__eye${privacy.showPhone ? ' is-on' : ''}`}
                          onClick={() => patchPrivacy({ showPhone: !privacy.showPhone })}
                        >
                          {privacy.showPhone ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {privacy.showPhone ? 'Görünür' : 'Gizli'}
                        </button>
                      </div>
                      <input
                        value={customer?.phone ? formatPhoneInput(customer.phone) : '—'}
                        readOnly
                      />
                    </div>

                    <div className="mc-auth__field">
                      <div className="mc-profile__field-row">
                        <label>E-posta <small>(opsiyonel)</small></label>
                        <button
                          type="button"
                          className={`mc-profile__eye${privacy.showEmail ? ' is-on' : ''}`}
                          onClick={() => patchPrivacy({ showEmail: !privacy.showEmail })}
                        >
                          {privacy.showEmail ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                          {privacy.showEmail ? 'Görünür' : 'Gizli'}
                        </button>
                      </div>
                      <input value={customer?.email || '—'} readOnly />
                    </div>
                  </section>
                </div>

                <div
                  className={`mc-profile__col mc-profile__col--prefs${
                    mobileTab === 'prefs' ? ' is-mobile-on' : ' is-mobile-away'
                  }`}
                >
                  <label className="mc-auth__switch">
                    <span>
                      <strong>{ui.personalFilter}</strong>
                      <small>{ui.personalFilterHint}</small>
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

                  <section className="mc-auth__block">
                    <div className="mc-auth__block-head">
                      <Wine className="w-4 h-4" />
                      <div>
                        <h3>{ui.alcohol}</h3>
                        <p>{ui.alcoholHint}</p>
                      </div>
                    </div>
                    <div className="mc-auth__alcohol">
                      <button
                        type="button"
                        className={alcohol === 'yes' ? 'is-active' : ''}
                        onClick={() => setAlcohol('yes')}
                      >
                        {ui.alcoholYes}
                      </button>
                      <button
                        type="button"
                        className={alcohol === 'no' ? 'is-active is-no' : ''}
                        onClick={() => setAlcohol('no')}
                      >
                        {ui.alcoholNo}
                      </button>
                    </div>
                  </section>

                  <section className="mc-auth__block">
                    <div className="mc-auth__block-head">
                      <Sparkles className="w-4 h-4" />
                      <div>
                        <h3>{ui.allergies}</h3>
                        <p>{ui.allergiesHint}</p>
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
                        <h3>{ui.diet}</h3>
                        <p>{ui.dietHint}</p>
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
                    label={ui.likedFoods}
                    hint={ui.likedHint}
                    values={liked}
                    onChange={setLiked}
                    placeholder={ui.likedPlaceholder}
                    tone="like"
                  />
                  <ChipEditor
                    label={ui.dislikedFoods}
                    hint={ui.dislikedHint}
                    values={disliked}
                    onChange={setDisliked}
                    placeholder={ui.dislikedPlaceholder}
                    tone="dislike"
                  />
                </div>
              </div>

              <div className="mc-auth__footer">
                <button type="submit" className="mc-auth__primary" disabled={busy}>
                  {busy ? ui.saving : ui.save}
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
                  {ui.logout}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

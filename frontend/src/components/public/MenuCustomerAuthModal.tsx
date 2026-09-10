import { useEffect, useMemo, useState } from 'react';
import { KeyRound, LogOut, UserRound, X } from 'lucide-react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
} from '@/lib/dietAllergens';

type Mode = 'login' | 'register' | 'profile';
type LoginType = 'email' | 'phone';

type Props = {
  open: boolean;
  onClose: () => void;
  restaurantId?: number | null;
  restaurantName?: string;
  lang?: string;
};

function formatPhoneInput(raw: string) {
  const d = raw.replace(/\D/g, '').slice(0, 11);
  if (d.length <= 4) return d;
  if (d.length <= 7) return `${d.slice(0, 4)} ${d.slice(4)}`;
  if (d.length <= 9) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7, 9)} ${d.slice(9)}`;
}

function ChipEditor({
  label,
  values,
  onChange,
  placeholder,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    if (!v) return;
    if (values.some((x) => x.toLowerCase() === v.toLowerCase())) {
      setDraft('');
      return;
    }
    onChange([...values, v].slice(0, 40));
    setDraft('');
  }
  return (
    <div className="mc-auth__field">
      <label>{label}</label>
      <div className="mc-auth__chips">
        {values.map((v) => (
          <button
            key={v}
            type="button"
            className="mc-auth__chip"
            onClick={() => onChange(values.filter((x) => x !== v))}
          >
            {v} ×
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
              add();
            }
          }}
        />
        <button type="button" onClick={add}>
          Ekle
        </button>
      </div>
    </div>
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

  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [profileName, setProfileName] = useState('');

  const points = restaurantPoints(restaurantId);

  useEffect(() => {
    if (!open) return;
    setError('');
    setPassword('');
    if (customer) {
      setMode('profile');
      setProfileName(customer.fullName);
      setAllergens(customer.allergenTags || []);
      setDiets(customer.dietTags || []);
      setLiked(customer.likedFoods || []);
      setDisliked(customer.dislikedFoods || []);
      void refresh(restaurantId);
    } else {
      setMode('login');
      setKvkk(false);
    }
  }, [open, customer, restaurantId, refresh]);

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
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mc-auth" role="dialog" aria-modal="true" aria-labelledby="mc-auth-title">
      <button type="button" className="mc-auth__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="mc-auth__panel">
        <header className="mc-auth__head">
          <div className="mc-auth__head-icon">
            {mode === 'profile' ? <UserRound className="w-5 h-5" /> : <KeyRound className="w-5 h-5" />}
          </div>
          <div className="min-w-0 flex-1">
            <h2 id="mc-auth-title">{title}</h2>
            <p>
              {mode === 'profile'
                ? restaurantName
                  ? `${restaurantName} · puan: ${points}`
                  : `Puan: ${points}`
                : 'Tüm QR menülerimizde aynı hesabınla giriş yapabilirsin.'}
            </p>
          </div>
          <button type="button" className="mc-auth__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        <div className="mc-auth__body">
          {error ? <div className="mc-auth__error">{error}</div> : null}

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
            <form className="mc-auth__form" onSubmit={(e) => void saveProfile(e)}>
              <div className="mc-auth__points">
                <span>Bu restorandaki puanın</span>
                <strong>{points}</strong>
              </div>

              <label className="mc-auth__check">
                <input
                  type="checkbox"
                  checked={filterEnabled}
                  onChange={(e) => setFilterEnabled(e.target.checked)}
                />
                <span>Menüyü tercihlerime göre filtrele</span>
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

              <div className="mc-auth__field">
                <label>Alerjiler</label>
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
              </div>

              <div className="mc-auth__field">
                <label>Diyet / tercih</label>
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
              </div>

              <ChipEditor
                label="Sevdiğim yemekler"
                values={liked}
                onChange={setLiked}
                placeholder="Örn. pizza"
              />
              <ChipEditor
                label="Sevmediğim yemekler"
                values={disliked}
                onChange={setDisliked}
                placeholder="Örn. alkol"
              />

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
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Eye,
  EyeOff,
  Gift,
  Heart,
  IdCard,
  LogOut,
  QrCode,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Star,
  ThumbsDown,
  Wallet,
  X,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCustomerAuth } from '@/contexts/CustomerAuthContext';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import {
  ALLERGEN_CATALOG,
  DIET_CATALOG,
  allergenLabel,
  dietLabel,
} from '@/lib/dietAllergens';
import { customerProfileUi } from '@/lib/customerProfileUi';
import {
  CUSTOMER_QR_TTL_MS,
  formatCustomerCodeDisplay,
  readCustomerPrivacy,
  writeCustomerPrivacy,
  type CustomerPrivacyFlags,
} from '@/lib/customerQrPreview';
import { issueCustomerQrChallenge } from '@/lib/customerUnlock';
import { avatarHue } from '@/lib/customerAvatar';
import { ContactRow, NameRow } from './CustomerContactRow';
import './customer-account.css';

type Tab = 'code' | 'prefs' | 'info' | 'perks';
type AlcoholPref = 'yes' | 'no' | 'unset';

export type CustomerAccountProps = {
  open: boolean;
  onClose: () => void;
  restaurantId?: number | null;
  restaurantName?: string;
  logoUrl?: string | null;
  /** Business photos shown on the sign-in screen. */
  photos?: string[];
  lang?: string;
};

const sameSet = (a: string[], b: string[]) =>
  a.length === b.length && [...a].sort().join('|') === [...b].sort().join('|');

/** Açılan pencerenin altındaki sayfanın açık/koyu olduğunu, ilk opak arka plandan anlar. */
function detectDark(el: HTMLElement | null) {
  for (let node = el?.parentElement; node; node = node.parentElement) {
    const m = getComputedStyle(node).backgroundColor.match(/[\d.]+/g);
    if (!m) continue;
    const [r, g, b] = m.map(Number);
    const a = m.length > 3 ? m[3] : 1;
    if (Number(a) < 0.6) continue;
    return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.5;
  }
  return false;
}

function Switch({
  on,
  onChange,
  label,
}: {
  on: boolean;
  onChange: (next: boolean) => void;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      className={`ca-switch${on ? ' is-on' : ''}`}
      onClick={() => onChange(!on)}
    >
      <i />
    </button>
  );
}

function TasteEditor({
  tone,
  label,
  hint,
  placeholder,
  values,
  onChange,
}: {
  tone: 'like' | 'dislike';
  label: string;
  hint: string;
  placeholder: string;
  values: string[];
  onChange: (next: string[]) => void;
}) {
  const [draft, setDraft] = useState('');
  function add() {
    const v = draft.trim();
    setDraft('');
    if (!v) return;
    if (values.some((x) => x.toLocaleLowerCase('tr-TR') === v.toLocaleLowerCase('tr-TR'))) return;
    onChange([...values, v].slice(0, 40));
  }
  const Icon = tone === 'like' ? Heart : ThumbsDown;
  return (
    <div className={`ca-taste ca-taste--${tone}`}>
      <div className="ca-taste__head">
        <Icon size={16} aria-hidden />
        <div>
          <strong>{label}</strong>
          <small>{hint}</small>
        </div>
        <em className="ca-taste__n">{values.length}</em>
      </div>
      {values.length ? (
        <div className="ca-chips">
          {values.map((v) => (
            <button
              key={v}
              type="button"
              className="ca-chip is-on"
              aria-label={`${v} — kaldır`}
              onClick={() => onChange(values.filter((x) => x !== v))}
            >
              {v}
              <X size={12} aria-hidden />
            </button>
          ))}
        </div>
      ) : (
        <p className="ca-taste__empty">{tone === 'like' ? 'Henüz eklemedin' : 'Henüz bir şey yok'}</p>
      )}
      <div className="ca-add">
        <input
          value={draft}
          placeholder={placeholder}
          enterKeyHint="done"
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              add();
            }
          }}
        />
        <button type="button" onClick={add} disabled={!draft.trim()}>
          Ekle
        </button>
      </div>
    </div>
  );
}

export default function MenuCustomerProfileModal({
  open,
  onClose,
  restaurantId,
  restaurantName,
  lang = 'tr',
}: CustomerAccountProps) {
  const { customer, logout, updateProfile, refresh, restaurantPoints, filterEnabled, setFilterEnabled } =
    useCustomerAuth();
  const wide = useMediaQuery('(min-width: 900px)');
  const rootRef = useRef<HTMLDivElement>(null);
  const [dark, setDark] = useState(false);

  const [tab, setTab] = useState<Tab>('prefs');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const [alcohol, setAlcohol] = useState<AlcoholPref>('unset');
  const [allergens, setAllergens] = useState<string[]>([]);
  const [diets, setDiets] = useState<string[]>([]);
  const [liked, setLiked] = useState<string[]>([]);
  const [disliked, setDisliked] = useState<string[]>([]);
  const [privacy, setPrivacy] = useState<CustomerPrivacyFlags>({
    showName: true,
    showPhone: true,
    showEmail: true,
  });

  const [qr, setQr] = useState({ payload: '', code: '', expiresAt: 0 });
  const [qrBusy, setQrBusy] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pointsQuery, setPointsQuery] = useState('');

  const ui = customerProfileUi(lang || 'tr');
  const points = restaurantPoints(restaurantId);

  async function rotateQr() {
    setQrBusy(true);
    try {
      const c = await issueCustomerQrChallenge();
      setQr({ payload: c.qrPayload, code: c.code, expiresAt: c.expiresAt });
    } catch {
      setQr({ payload: '', code: '', expiresAt: 0 });
      setError('Kişisel kod üretilemedi — yenile’ye bas');
    } finally {
      setQrBusy(false);
    }
  }

  // Açılışta: formu müşteriden doldur, kodu üret, puanı tazele.
  useEffect(() => {
    if (!open || !customer) return;
    setError('');
    setSaved(false);
    setTab(wide ? 'prefs' : 'code');
    setAllergens(customer.allergenTags || []);
    setDiets(customer.dietTags || []);
    setLiked(customer.likedFoods || []);
    setDisliked(customer.dislikedFoods || []);
    setAlcohol(customer.drinksAlcohol === true ? 'yes' : customer.drinksAlcohol === false ? 'no' : 'unset');
    setPrivacy(readCustomerPrivacy(customer.id));
    setDark(detectDark(rootRef.current));
    void rotateQr();
    if (restaurantId) void refresh(restaurantId).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id]);

  // Kod süresi dolunca kendiliğinden yenile; sayaç için 500 ms.
  useEffect(() => {
    if (!open || !customer) return;
    const t = window.setInterval(() => {
      const n = Date.now();
      setNow(n);
      if (qr.expiresAt && n >= qr.expiresAt && !qrBusy) void rotateQr();
    }, 500);
    return () => window.clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, customer?.id, qr.expiresAt, qrBusy]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  // Geniş ekranda kod her zaman solda; "Kodum" sekmesi yalnızca telefon içindir.
  useEffect(() => {
    if (wide && tab === 'code') setTab('prefs');
  }, [wide, tab]);

  const perRestaurant = useMemo(() => {
    const map = customer?.pointsByRestaurant || {};
    const q = pointsQuery.trim().toLocaleLowerCase('tr-TR');
    return Object.entries(map)
      .map(([id, pts]) => ({
        id,
        points: Number(pts) || 0,
        current: restaurantId != null && String(restaurantId) === id,
        label: restaurantId != null && String(restaurantId) === id && restaurantName ? restaurantName : `Restoran #${id}`,
      }))
      .filter((r) => !r.current)
      .filter((r) => !q || r.label.toLocaleLowerCase('tr-TR').includes(q))
      .sort((a, b) => b.points - a.points);
  }, [customer?.pointsByRestaurant, restaurantId, restaurantName, pointsQuery]);
  const otherCount = Object.keys(customer?.pointsByRestaurant || {}).filter(
    (id) => String(restaurantId) !== id,
  ).length;

  if (!open || !customer) return null;

  const firstName = customer.fullName.trim().split(/\s+/)[0] || 'Misafir';
  const hue = avatarHue(customer.id);
  const dirty =
    alcohol !== (customer.drinksAlcohol === true ? 'yes' : customer.drinksAlcohol === false ? 'no' : 'unset') ||
    !sameSet(allergens, customer.allergenTags || []) ||
    !sameSet(diets, customer.dietTags || []) ||
    !sameSet(liked, customer.likedFoods || []) ||
    !sameSet(disliked, customer.dislikedFoods || []);
  const activeCount =
    allergens.length + diets.length + disliked.length + (alcohol === 'no' ? 1 : 0);
  const secondsLeft = Math.max(0, Math.ceil((qr.expiresAt - now) / 1000));
  const ratio = Math.max(0, Math.min(1, (qr.expiresAt - now) / CUSTOMER_QR_TTL_MS));

  function patchPrivacy(patch: Partial<CustomerPrivacyFlags>) {
    setPrivacy((prev) => {
      const next = { ...prev, ...patch };
      writeCustomerPrivacy(customer!.id, next);
      return next;
    });
  }

  function toggleIn(list: string[], set: (v: string[]) => void, id: string) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      await updateProfile({
        allergenTags: allergens,
        dietTags: diets,
        likedFoods: liked,
        dislikedFoods: disliked,
        drinksAlcohol: alcohol === 'yes' ? true : alcohol === 'no' ? false : null,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Kaydedilemedi');
    } finally {
      setBusy(false);
    }
  }

  const tabs: { id: Tab; label: string; icon: typeof QrCode }[] = [
    { id: 'code', label: 'Kodum', icon: QrCode },
    { id: 'prefs', label: 'Tercihler', icon: SlidersHorizontal },
    { id: 'info', label: 'Bilgilerim', icon: IdCard },
    { id: 'perks', label: 'Avantajlar', icon: Gift },
  ];

  const visibility = (key: keyof CustomerPrivacyFlags, label: string) => (
    <button
      type="button"
      className={`ca-eye${privacy[key] ? ' is-on' : ''}`}
      aria-pressed={privacy[key]}
      aria-label={`${label}: ${privacy[key] ? 'restoran görür' : 'gizli'}`}
      onClick={() => patchPrivacy({ [key]: !privacy[key] })}
    >
      {privacy[key] ? <Eye size={16} aria-hidden /> : <EyeOff size={16} aria-hidden />}
      <span>{privacy[key] ? 'Görünür' : 'Gizli'}</span>
    </button>
  );

  return (
    <div
      ref={rootRef}
      className="ca"
      data-theme={dark ? 'dark' : 'light'}
      role="dialog"
      aria-modal="true"
      aria-label={ui.myProfile}
    >
      <button type="button" className="ca__scrim" aria-label={ui.close} onClick={onClose} />
      <div className="ca__panel" data-tab={tab}>
        <span className="ca__grab" aria-hidden />

        {/* Sol/üst: kimlik kartı + kişisel kod */}
        <aside className="ca__aside">
          <div className="ca-id">
            <span className="ca-avatar" style={{ ['--h' as string]: hue }} aria-hidden>
              {firstName.charAt(0).toLocaleUpperCase('tr')}
            </span>
            <div>
              <p>Merhaba</p>
              <h2>{customer.fullName}</h2>
              {restaurantName ? <small>{restaurantName}</small> : null}
            </div>
          </div>

          <div className="ca-ticket">
            <div className="ca-ticket__qr">
              {qr.payload ? (
                <QRCodeSVG value={qr.payload} size={192} level="M" bgColor="#ffffff" fgColor="#0f172a" />
              ) : (
                <span className="ca-ticket__empty">{qrBusy ? 'Üretiliyor…' : 'Kod yok'}</span>
              )}
            </div>
            <div className="ca-ticket__cut" aria-hidden />
            <div className="ca-ticket__code" aria-live="polite">
              <small>Garsona söyle veya okut</small>
              <strong>{qr.code ? formatCustomerCodeDisplay(qr.code) : '--- ---'}</strong>
            </div>
            <div className="ca-ticket__foot">
              <span className="ca-timer" style={{ ['--p' as string]: ratio }} aria-hidden>
                <b>{secondsLeft}</b>
              </span>
              <span className="ca-ticket__hint">sn sonra yenilenir</span>
              <button type="button" disabled={qrBusy} onClick={() => void rotateQr()}>
                <RefreshCw size={14} aria-hidden className={qrBusy ? 'is-spin' : ''} />
                Yenile
              </button>
            </div>
          </div>

          <button type="button" className="ca-points" onClick={() => setTab('perks')}>
            <Star size={18} aria-hidden />
            <span>
              <strong>{points} puan</strong>
              <small>{restaurantName || 'Bu restoranda'}</small>
            </span>
            <em>Avantajlar</em>
          </button>

          <button
            type="button"
            className="ca-logout"
            onClick={() => {
              logout();
              onClose();
            }}
          >
            <LogOut size={16} aria-hidden />
            {ui.logout}
          </button>
        </aside>

        <section className="ca__main">
          <header className="ca__top">
            <span className="ca-avatar ca-avatar--sm" style={{ ['--h' as string]: hue }} aria-hidden>
              {firstName.charAt(0).toLocaleUpperCase('tr')}
            </span>
            <strong>{customer.fullName}</strong>
            <button type="button" className="ca-x" onClick={onClose} aria-label={ui.close}>
              <X size={20} aria-hidden />
            </button>
          </header>

          <nav className="ca-tabs" aria-label="Hesap bölümleri">
            {tabs.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                data-tab={id}
                className={`ca-tab${tab === id ? ' is-active' : ''}`}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <Icon size={17} aria-hidden />
                <span>{label}</span>
                {id === 'prefs' && activeCount > 0 ? <em>{activeCount}</em> : null}
              </button>
            ))}
            <button type="button" className="ca-x ca-x--desk" onClick={onClose} aria-label={ui.close}>
              <X size={20} aria-hidden />
            </button>
          </nav>

          <div className="ca__scroll">
            {tab === 'prefs' ? (
              <div className="ca-sec" key="prefs">
                <div className={`ca-master${filterEnabled ? ' is-on' : ''}`}>
                  <span className="ca-master__icon" aria-hidden>
                    <SlidersHorizontal size={20} />
                  </span>
                  <div>
                    <strong>Menüyü bana göre filtrele</strong>
                    <small>{ui.personalFilterHint}</small>
                  </div>
                  <Switch on={filterEnabled} onChange={setFilterEnabled} label="Kişisel filtre" />
                </div>

                <fieldset className="ca-group">
                  <legend>{ui.alcohol}</legend>
                  <div className="ca-seg">
                    {(
                      [
                        ['yes', ui.alcoholYes],
                        ['no', ui.alcoholNo],
                      ] as const
                    ).map(([v, label]) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={alcohol === v}
                        className={alcohol === v ? 'is-active' : ''}
                        onClick={() => setAlcohol(alcohol === v ? 'unset' : v)}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="ca-group">
                  <legend>{ui.allergies}</legend>
                  <div className="ca-chips">
                    {ALLERGEN_CATALOG.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        aria-pressed={allergens.includes(a.id)}
                        className={`ca-chip${allergens.includes(a.id) ? ' is-on is-warn' : ''}`}
                        onClick={() => toggleIn(allergens, setAllergens, a.id)}
                      >
                        {allergenLabel(a.id, lang)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <fieldset className="ca-group">
                  <legend>{ui.diet}</legend>
                  <div className="ca-chips">
                    {DIET_CATALOG.map((d) => (
                      <button
                        key={d.id}
                        type="button"
                        aria-pressed={diets.includes(d.id)}
                        className={`ca-chip${diets.includes(d.id) ? ' is-on' : ''}`}
                        onClick={() => toggleIn(diets, setDiets, d.id)}
                      >
                        {dietLabel(d.id, lang)}
                      </button>
                    ))}
                  </div>
                </fieldset>

                <div className="ca-tastes">
                  <TasteEditor
                    tone="like"
                    label={ui.likedFoods}
                    hint={ui.likedHint}
                    placeholder={ui.likedPlaceholder}
                    values={liked}
                    onChange={setLiked}
                  />
                  <TasteEditor
                    tone="dislike"
                    label={ui.dislikedFoods}
                    hint={ui.dislikedHint}
                    placeholder={ui.dislikedPlaceholder}
                    values={disliked}
                    onChange={setDisliked}
                  />
                </div>
              </div>
            ) : null}

            {tab === 'info' ? (
              <div className="ca-sec" key="info">
                <p className="ca-lead">Restoranlar yalnızca “Görünür” bıraktığın bilgileri görür.</p>
                <NameRow label={ui.fullName} visibility={visibility('showName', ui.fullName)} />
                <ContactRow
                  field="phone"
                  label="Telefon"
                  current={customer.phone}
                  restaurantId={restaurantId}
                  visibility={visibility('showPhone', 'Telefon')}
                />
                <ContactRow
                  field="email"
                  label={
                    <>
                      E-posta <small>(opsiyonel)</small>
                    </>
                  }
                  current={customer.email}
                  restaurantId={restaurantId}
                  visibility={visibility('showEmail', 'E-posta')}
                />
                <p className="ca-lead ca-lead--small">Telefon veya e-posta değişince yeni değere bir doğrulama kodu gönderilir. İsim değişikliği kod istemez.</p>
              </div>
            ) : null}

            {tab === 'perks' ? (
              <div className="ca-sec" key="perks">
                <div className="ca-hero-points">
                  <Star size={22} aria-hidden />
                  <div>
                    <small>{restaurantName || 'Bu restoran'}</small>
                    <strong>{points}</strong>
                    <span>puanın var</span>
                  </div>
                </div>

                <div className="ca-pair">
                  <div>
                    <Gift size={18} aria-hidden />
                    <strong>Özel indirim</strong>
                    <small>Şimdilik yok</small>
                  </div>
                  <div>
                    <Wallet size={18} aria-hidden />
                    <strong>Borç / bakiye</strong>
                    <small>Borcun yok</small>
                  </div>
                </div>

                <div className="ca-group">
                    <p className="ca-legend">Diğer restoranlardaki puanların</p>
                    <label className="ca-search">
                        <Search size={16} aria-hidden />
                        <input
                          value={pointsQuery}
                          onChange={(e) => setPointsQuery(e.target.value)}
                          placeholder="Restoran ara…"
                        />
                      </label>
                    <ul className="ca-list">
                      {perRestaurant.map((r) => (
                        <li key={r.id}>
                          <span>{r.label}</span>
                          <b>{r.points}</b>
                        </li>
                      ))}
                      {!perRestaurant.length ? <li className="is-empty">{otherCount ? 'Sonuç yok' : 'Başka restoranda puanın yok'}</li> : null}
                    </ul>
                  </div>
              </div>
            ) : null}
          </div>

          {/* Değişiklik varsa belirir: tek dokunuşla kaydet */}
          <div className={`ca-save${dirty || saved || error ? ' is-show' : ''}`} role="status">
            {error ? (
              <p className="ca-save__msg is-err">{error}</p>
            ) : saved ? (
              <p className="ca-save__msg is-ok">
                <Check size={16} aria-hidden /> Kaydedildi
              </p>
            ) : (
              <p className="ca-save__msg">Kaydedilmemiş değişiklikler var</p>
            )}
            <button type="button" disabled={busy || !dirty} onClick={() => void save()}>
              {busy ? ui.saving : ui.save}
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

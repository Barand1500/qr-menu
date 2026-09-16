import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Download, Hash, LogOut, Smartphone } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import GarsonCallsPanel from '@/components/admin/GarsonCallsPanel';
import GarsonUnlockDock from '@/components/admin/GarsonUnlockDock';
import { Input } from '@/components/ui';
import { adminPath } from '@/lib/adminPath';
import { applyDocumentTitle, getSiteTitle } from '@/lib/siteTitle';
import { playAdminNotificationSound } from '@/lib/notificationSound';
import {
  armGarsonInstallCapture,
  ensureGarsonNotificationPermission,
  injectGarsonManifest,
  isGarsonStandalone,
  isIosSafari,
  promptGarsonInstall,
  registerGarsonServiceWorker,
  showGarsonCallNotification,
  subscribeGarsonInstallReady,
} from '@/lib/garsonPwa';
import { formatTableServiceLabel } from '@/lib/tableContext';
import type { GarsonCallRow } from '@/components/admin/GarsonCallsPanel';
import '@/garson-panel.css';
import '@/garson-app.css';

type UnlockMode = 'scan' | 'code' | null;

export default function GarsonAppPage() {
  const { user, loading, login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [installReady, setInstallReady] = useState(false);
  const [iosHint, setIosHint] = useState(false);
  const [notifState, setNotifState] = useState<string>('default');
  const [unlockMode, setUnlockMode] = useState<UnlockMode>(null);
  const lastUnread = useRef<number | null>(null);
  const knownIds = useRef<Set<number>>(new Set());

  useEffect(() => {
    injectGarsonManifest();
    void registerGarsonServiceWorker();
    const offArm = armGarsonInstallCapture();
    const offSub = subscribeGarsonInstallReady(setInstallReady);
    document.title = `${getSiteTitle()} · Garson`;
    return () => {
      offArm();
      offSub();
      applyDocumentTitle();
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    void ensureGarsonNotificationPermission().then((p) => setNotifState(String(p)));
  }, [user]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(email.trim(), password, remember);
      const perm = await ensureGarsonNotificationPermission();
      setNotifState(String(perm));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Giriş başarısız');
    } finally {
      setBusy(false);
    }
  }

  async function onInstallClick() {
    const outcome = await promptGarsonInstall();
    if (outcome === 'unavailable') {
      if (isIosSafari() && !isGarsonStandalone()) setIosHint(true);
    }
  }

  function handleCallsSnapshot(rows: GarsonCallRow[], unread: number) {
    const prev = lastUnread.current;
    lastUnread.current = unread;

    const unreadRows = rows.filter((r) => !r.isRead);
    const newest = unreadRows[0];

    if (prev == null) {
      knownIds.current = new Set(rows.map((r) => r.id));
      return;
    }

    const fresh = unreadRows.filter((r) => !knownIds.current.has(r.id));
    knownIds.current = new Set(rows.map((r) => r.id));

    if (fresh.length === 0 && !(unread > prev)) return;

    const focus = fresh[0] || newest;
    const label = focus
      ? formatTableServiceLabel(focus.tableNumber, focus.groupSlug)
      : 'Masa';
    const kind =
      focus?.type === 'bill' ? 'Hesap istedi' : focus?.orderJson ? 'Sipariş + garson' : 'Garson çağırdı';

    playAdminNotificationSound();
    void showGarsonCallNotification({
      title: `${label}`,
      body: kind,
      tag: focus ? `garson-${focus.id}` : 'garson-call',
    });
  }

  if (loading) {
    return (
      <div className="garson-app garson-app--boot">
        <div className="garson-app__boot-card">Yükleniyor…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="garson-app garson-app--login">
        <div className="garson-app__login-card">
          <div className="garson-app__brand">
            <span className="garson-app__logo" aria-hidden>
              <Smartphone className="w-7 h-7" />
            </span>
            <div>
              <p className="garson-app__eyebrow">Menu QR</p>
              <h1>Garson uygulaması</h1>
              <p>Kullanıcılar kısmındaki e-posta ve şifre ile giriş yapın. Ana ekrana ekleyerek telefonda uygulama gibi kullanın.</p>
            </div>
          </div>

          <form onSubmit={(e) => void handleLogin(e)} className="garson-app__form">
            {error ? <div className="garson-app__error">{error}</div> : null}
            <Input
              type="email"
              label="E-posta"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
            <Input
              type="password"
              label="Şifre"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
            <label className="garson-app__remember">
              <input
                type="checkbox"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
              Beni hatırla
            </label>
            <button type="submit" className="garson-app__primary" disabled={busy}>
              {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
            </button>
          </form>

          {!isGarsonStandalone() ? (
            <div className="garson-app__install">
              <button type="button" className="garson-app__install-btn" onClick={() => void onInstallClick()}>
                <Download className="w-4 h-4" />
                Ana ekrana ekle
              </button>
              {iosHint ? (
                <p className="garson-app__ios-hint">
                  iPhone’da: Safari → Paylaş → <strong>Ana Ekrana Ekle</strong>
                </p>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div className={`garson-app${unlockMode === 'scan' ? ' is-scanning' : ''}`}>
      <header className="garson-app__topbar">
        <div className="garson-app__topbar-brand">
          <span className="garson-app__logo is-sm" aria-hidden>
            <Smartphone className="w-4 h-4" />
          </span>
          <div>
            <strong>{user.fullName}</strong>
            <small>{user.restaurant?.name || 'Garson'}</small>
          </div>
        </div>
        <div className="garson-app__topbar-actions">
          <button
            type="button"
            className={`garson-app__chip is-accent${unlockMode === 'scan' ? ' is-on' : ''}`}
            onClick={() => setUnlockMode((m) => (m === 'scan' ? null : 'scan'))}
          >
            <Camera className="w-3.5 h-3.5" />
            Kod oku
          </button>
          <button
            type="button"
            className={`garson-app__chip${unlockMode === 'code' ? ' is-on' : ''}`}
            onClick={() => setUnlockMode((m) => (m === 'code' ? null : 'code'))}
          >
            <Hash className="w-3.5 h-3.5" />
            Kod yaz
          </button>
          {!isGarsonStandalone() && (installReady || isIosSafari()) ? (
            <button type="button" className="garson-app__chip" onClick={() => void onInstallClick()}>
              <Download className="w-3.5 h-3.5" />
              Ekle
            </button>
          ) : null}
          {notifState !== 'granted' && notifState !== 'unsupported' ? (
            <button
              type="button"
              className="garson-app__chip"
              onClick={() =>
                void ensureGarsonNotificationPermission().then((p) => setNotifState(String(p)))
              }
            >
              Bildirim aç
            </button>
          ) : null}
          <button type="button" className="garson-app__chip is-ghost" onClick={logout} title="Çıkış">
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {iosHint ? (
        <div className="garson-app__banner">
          Safari → Paylaş → Ana Ekrana Ekle ile uygulama gibi kullanın.
          <button type="button" onClick={() => setIosHint(false)}>
            Tamam
          </button>
        </div>
      ) : null}

      {unlockMode === 'code' ? (
        <GarsonUnlockDock
          mode="code"
          onClose={() => setUnlockMode(null)}
          onUnlocked={(customerId) => {
            navigate(`${adminPath('customers')}?open=${customerId}`);
          }}
        />
      ) : null}

      <div className={`garson-app__body${unlockMode === 'scan' ? ' is-hidden' : ''}`}>
        <GarsonCallsPanel onCallsSnapshot={handleCallsSnapshot} />
      </div>

      {unlockMode === 'scan' ? (
        <GarsonUnlockDock
          mode="scan"
          onClose={() => setUnlockMode(null)}
          onUnlocked={(customerId) => {
            navigate(`${adminPath('customers')}?open=${customerId}`);
          }}
        />
      ) : null}
    </div>
  );
}

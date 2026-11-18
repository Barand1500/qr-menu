import { useEffect, useState } from 'react';
import { ConciergeBell, Gamepad2, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import MaintenanceRunnerGame from '@/components/public/MaintenanceRunnerGame';
import '@/maintenance.css';

type Props = {
  slug: string | null;
  restaurantName?: string | null;
  children: React.ReactNode;
};

const BULBS = Array.from({ length: 11 }, (_, i) => i);

export default function MaintenanceGate({ slug, restaurantName, children }: Props) {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [checking, setChecking] = useState(false);
  const [name, setName] = useState(restaurantName || '');

  /** silent: arka plan kontrolü sayfayı yükleniyor ekranına çevirmez. */
  async function check(silent = false) {
    if (!slug) {
      setLoading(false);
      return;
    }
    if (silent) setChecking(true);
    else setLoading(true);
    try {
      const res = await api<{ enabled: boolean; restaurantName?: string }>(
        `/api/menu/${slug}/maintenance`
      );
      setEnabled(Boolean(res.enabled));
      if (res.restaurantName) setName(res.restaurantName);
    } catch {
      if (!silent) setEnabled(false);
    } finally {
      setLoading(false);
      setChecking(false);
    }
  }

  useEffect(() => {
    void check();
  }, [slug]);

  // Bakım sürerken menü açıldı mı diye arada sessizce bakar; açılınca menü kendiliğinden gelir.
  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void check(true);
    }, 30000);
    return () => window.clearInterval(id);
  }, [enabled, slug]);

  if (!slug) return <>{children}</>;
  if (loading) {
    return (
      <div className="maint-screen maint-screen--loading">
        <div className="maint-screen__spin" />
      </div>
    );
  }
  if (!enabled) return <>{children}</>;

  return (
    <div className="maint-screen" role="status" aria-live="polite">
      <div className="maint-glow" aria-hidden>
        <span className="maint-glow__a" />
        <span className="maint-glow__b" />
        {[0, 1, 2, 3, 4].map((i) => (
          <span key={i} className="maint-steam" style={{ ['--i' as string]: i }} />
        ))}
      </div>

      <div className="maint-lights" aria-hidden>
        {BULBS.map((i) => (
          <span key={i} style={{ ['--i' as string]: i }} />
        ))}
      </div>

      <main className="maint-shell">
        <header className="maint-hero">
          <span className="maint-status">
            <i aria-hidden />
            Mutfak hazırlıkta
          </span>
          {name ? <p className="maint-hero__name">{name}</p> : null}
          <h1>
            Menü <em>birazdan</em> geliyor
          </h1>
          <p className="maint-hero__lead">
            Siparişiniz için masanıza gelen garsonumuza söylemeniz yeterli.
          </p>
          <ul className="maint-chips">
            <li>
              <ConciergeBell size={16} /> Garsonumuza söyleyin
            </li>
            <li>
              <Gamepad2 size={16} /> Beklerken oynayın
            </li>
          </ul>
        </header>

        <MaintenanceRunnerGame slug={slug} />
      </main>

      <div className="maint-dock">
        <button
          type="button"
          className="maint-dock__btn"
          disabled={checking}
          onClick={() => void check(true)}
        >
          <RefreshCw size={16} className={checking ? 'animate-spin' : undefined} />
          {checking ? 'Kontrol ediliyor…' : 'Menü açıldı mı?'}
        </button>
        <span>Menü açılınca sayfa kendiliğinden yenilenir</span>
      </div>
    </div>
  );
}

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
      <div className="maint-screen__bg" aria-hidden>
        <span className="maint-screen__orb maint-screen__orb--a" />
        <span className="maint-screen__orb maint-screen__orb--b" />
        <span className="maint-screen__orb maint-screen__orb--c" />
      </div>

      <div className="maint-screen__layout">
        <header className="maint-screen__top">
          <div className="maint-bell" aria-hidden>
            <span className="maint-bell__ring" />
            <span className="maint-bell__ring maint-bell__ring--late" />
            <span className="maint-bell__icon">
              <ConciergeBell className="w-7 h-7" strokeWidth={1.7} />
            </span>
          </div>
          <p className="maint-screen__eyebrow">{name || 'Restoranımız'}</p>
          <h1>Menü birazdan geliyor</h1>
          <p className="maint-screen__lead">
            Mutfak kısa bir hazırlıkta. Siparişinizi garsonumuza söylemeniz yeterli.
          </p>
        </header>

        <section className="maint-screen__steps" aria-label="Ne yapabilirsiniz">
          <div>
            <ConciergeBell className="w-[18px] h-[18px]" />
            <span>
              <b>Garsonumuza söyleyin</b>
              Siparişinizi masanıza gelen ekibimiz alır.
            </span>
          </div>
          <div>
            <Gamepad2 className="w-[18px] h-[18px]" />
            <span>
              <b>Beklerken oynayın</b>
              Garson Koşusu’nda rekoru kırın.
            </span>
          </div>
        </section>

        <MaintenanceRunnerGame slug={slug} />

        <div className="maint-screen__dock">
          <button
            type="button"
            className="maint-screen__retry"
            disabled={checking}
            onClick={() => void check(true)}
          >
            <RefreshCw className={`w-4 h-4${checking ? ' animate-spin' : ''}`} />
            {checking ? 'Kontrol ediliyor…' : 'Menü açıldı mı?'}
          </button>
          <p>Menü açılınca bu sayfa kendiliğinden yenilenir.</p>
        </div>
      </div>
    </div>
  );
}

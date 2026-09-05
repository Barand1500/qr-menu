import { useEffect, useState } from 'react';
import { HardHat, RefreshCw, UtensilsCrossed } from 'lucide-react';
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
  const [name, setName] = useState(restaurantName || '');

  async function check() {
    if (!slug) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api<{ enabled: boolean; restaurantName?: string }>(
        `/api/menu/${slug}/maintenance`
      );
      setEnabled(Boolean(res.enabled));
      if (res.restaurantName) setName(res.restaurantName);
    } catch {
      setEnabled(false);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void check();
  }, [slug]);

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
          <div className="maint-screen__badge">
            <HardHat className="w-3.5 h-3.5" />
            Bakım çalışması
          </div>
          <p className="maint-screen__eyebrow">{name || 'Restoranımız'}</p>
          <h1>Menü birazdan geliyor</h1>
          <p className="maint-screen__lead">
            Bugünlük sipariş için garsonumuza söyleyin. Beklerken Garson Koşusu’nda yarışın.
          </p>
        </header>

        <MaintenanceRunnerGame slug={slug} />

        <ul className="maint-screen__notes">
          <li>
            <UtensilsCrossed className="w-4 h-4 shrink-0" />
            Bugünlük menü için masadaki garsonumuza söylemeniz yeterli.
          </li>
          <li>Yakında QR ile yine buradan bakabileceksiniz — sabrınız için teşekkürler.</li>
        </ul>

        <button type="button" className="maint-screen__retry" onClick={() => void check()}>
          <RefreshCw className="w-4 h-4" />
          Menü açıldı mı? Kontrol et
        </button>
      </div>
    </div>
  );
}

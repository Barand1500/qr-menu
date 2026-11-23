import type { ReactNode } from 'react';
import { ArrowUpRight, ShieldCheck, X } from 'lucide-react';
import AdminOverlay from './AdminOverlay';
import './integration-hub.css';

export type HubTile = {
  id: string;
  icon: ReactNode;
  title: string;
  blurb: string;
  status: { tone: 'ok' | 'idle' | 'off'; text: string };
  /** Kaydedilmemiş değişiklik var mı */
  dirty: boolean;
  /** Simge zemini (CSS gradient) */
  hue: string;
};

const PILL = { ok: 'Açık', idle: 'Eksik', off: 'Kapalı' } as const;

/**
 * Entegrasyonlar: eşit boyutlu kartlardan oluşan bağlantı merkezi.
 * Karta dokununca ayar paneli açılır (telefonda alttan, geniş ekranda sağdan).
 */
export default function IntegrationHub({
  tiles,
  openId,
  onOpen,
  onClose,
  busy,
  children,
}: {
  tiles: HubTile[];
  openId: string | null;
  onOpen: (id: string) => void;
  onClose: () => void;
  busy: boolean;
  children: ReactNode;
}) {
  const live = tiles.filter((t) => t.status.tone === 'ok').length;
  const open = tiles.find((t) => t.id === openId) || null;
  const ratio = tiles.length ? live / tiles.length : 0;
  const R = 22;
  const C = 2 * Math.PI * R;

  return (
    <div className="igh">
      <section className="igh-hero" aria-label="Bağlantı özeti">
        <span className="igh-ring" aria-hidden="true">
          <svg viewBox="0 0 56 56">
            <circle cx="28" cy="28" r={R} className="igh-ring__track" />
            <circle cx="28" cy="28" r={R} className="igh-ring__bar" strokeDasharray={`${C * ratio} ${C}`} />
          </svg>
          <b>
            {live}/{tiles.length}
          </b>
        </span>
        <div>
          <h2>
            {live === 0 ? 'Henüz bağlı bir şey yok' : live === tiles.length ? 'Hepsi bağlı, harika!' : `${live} bağlantı açık`}
          </h2>
          <p>
            <ShieldCheck size={15} aria-hidden="true" /> Şifreler şifreli saklanır, ekranda bir daha gösterilmez.
          </p>
        </div>
      </section>

      <div className="igh-grid">
        {tiles.map((t, i) => (
          <button
            key={t.id}
            type="button"
            className={`igh-tile is-${t.status.tone}`}
            style={{ ['--i' as string]: i, ['--hue' as string]: t.hue }}
            onClick={() => onOpen(t.id)}
            aria-haspopup="dialog"
          >
            <span className="igh-tile__body">
              <span className="igh-tile__top">
                <span className="igh-tile__icon" aria-hidden="true">
                  {t.icon}
                </span>
                <span className="igh-pill">
                  <i aria-hidden="true" /> {PILL[t.status.tone]}
                </span>
              </span>
              <strong>{t.title}</strong>
              <span className="igh-tile__blurb">{t.blurb}</span>
              <span className="igh-tile__foot">
                <small>{t.dirty ? 'Kaydedilmemiş değişiklik var' : t.status.text}</small>
                <ArrowUpRight size={18} aria-hidden="true" />
              </span>
            </span>
          </button>
        ))}
      </div>

      {open ? (
        <AdminOverlay label={`${open.title} ayarları`} className="igh-overlay" busy={busy} onClose={onClose}>
          <div className="igh-sheet">
            <header>
              <span className="igh-sheet__grip" aria-hidden="true" />
              <button type="button" onClick={onClose} disabled={busy} aria-label="Kapat">
                <X size={20} />
              </button>
            </header>
            <div className="igh-sheet__body">{children}</div>
          </div>
        </AdminOverlay>
      ) : null}
    </div>
  );
}

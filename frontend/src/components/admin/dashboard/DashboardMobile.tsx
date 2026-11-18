import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Eye,
  Layers,
  PackagePlus,
  Settings,
  Users,
} from 'lucide-react';
import { adminPath } from '@/lib/adminPath';
import { adminPreviewMenuUrl } from '@/lib/tableContext';
import AdminAccentPicker from '@/components/admin/AdminAccentPicker';
import DashboardCalendar from '@/components/DashboardCalendar';
import type { DashboardSummary, TopItem } from '@/lib/demoData';
import './dashboard-mobile.css';

type Month = { month: string; label?: string; gruplar: number; urunler: number };

function greeting(date = new Date()) {
  const h = date.getHours();
  if (h < 6) return 'İyi geceler';
  if (h < 12) return 'Günaydın';
  if (h < 18) return 'İyi günler';
  return 'İyi akşamlar';
}

/** Sayıyı kısa bir sürede 0'dan değerine sayar (hareket azaltma tercihinde doğrudan gösterir). */
function useCountUp(value: number) {
  const [shown, setShown] = useState(value);
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
      setShown(value);
      return;
    }
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / 700);
      setShown(Math.round(value * (1 - Math.pow(1 - t, 3))));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);
  return shown;
}

/**
 * Telefon için Özet: bugünün durumu en üstte, ardından kısayollar, menü sağlığı, en çok bakılanlar ve
 * son aylar. Takvim kapalı başlar. Masaüstündeki sürükle-bırak düzenleme burada yoktur.
 */
export default function DashboardMobile({
  restaurantName,
  summary,
  topGroups,
  topProducts,
  monthly,
}: {
  restaurantName: string;
  summary: DashboardSummary;
  topGroups: TopItem[];
  topProducts: TopItem[];
  monthly: Month[];
}) {
  const [tab, setTab] = useState<'groups' | 'products'>('groups');
  const [calendarOpen, setCalendarOpen] = useState(false);
  const views = useCountUp(summary.viewsToday.total);
  const unique = useCountUp(summary.viewsToday.unique);

  const { total, valid, invalid } = summary.products;
  const percent = total > 0 ? Math.round((valid / total) * 100) : 100;
  const [ringReady, setRingReady] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setRingReady(true), 80);
    return () => window.clearTimeout(t);
  }, []);
  const RADIUS = 34;
  const CIRC = 2 * Math.PI * RADIUS;

  const list = (tab === 'groups' ? topGroups : topProducts).slice(0, 5);
  const max = Math.max(1, ...list.map((i) => i.count));

  const months = useMemo(() => monthly.slice(-6), [monthly]);
  const monthMax = Math.max(1, ...months.flatMap((m) => [m.gruplar, m.urunler]));

  const today = new Date().toLocaleDateString('tr-TR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });

  return (
    <div className="dm">
      <section className="dm-hero" aria-label="Bugünün durumu">
        <div className="dm-hero__top">
          <span className="dm-hero__avatar" aria-hidden="true">
            {restaurantName.charAt(0)}
          </span>
          <div className="dm-hero__who">
            <p>
              {greeting()} · {today}
            </p>
            <h2>{restaurantName}</h2>
          </div>
          <AdminAccentPicker />
        </div>

        <div className="dm-hero__main">
          <div>
            <p className="dm-hero__label">
              <Eye size={15} aria-hidden="true" /> Bugünkü görüntüleme
            </p>
            <p className="dm-hero__number">{views.toLocaleString('tr-TR')}</p>
            <p className="dm-hero__unique">
              <Users size={14} aria-hidden="true" />
              <b>{unique.toLocaleString('tr-TR')}</b> tekil ziyaretçi
            </p>
          </div>
        </div>

        {months.length > 0 && (
          <div className="dm-hero__spark" aria-hidden="true">
            {months.map((m) => {
              const v = m.gruplar + m.urunler;
              const top = Math.max(1, ...months.map((x) => x.gruplar + x.urunler));
              return (
                <span key={m.month} style={{ height: `${Math.max(10, (v / top) * 100)}%` }} />
              );
            })}
          </div>
        )}

        <button
          type="button"
          className="dm-hero__cta"
          onClick={() => window.open(adminPreviewMenuUrl(), '_blank')}
        >
          <ExternalLink size={17} aria-hidden="true" />
          Menüyü gör
        </button>
      </section>

      <nav className="dm-actions" aria-label="Kısayollar">
        <Link to={`${adminPath('products')}?new=1`}>
          <span>
            <PackagePlus size={22} />
          </span>
          Ürün ekle
        </Link>
        <Link to={adminPath('groups')}>
          <span>
            <Layers size={22} />
          </span>
          Gruplar
        </Link>
        <Link to={adminPath('stats')}>
          <span>
            <BarChart3 size={22} />
          </span>
          İstatistik
        </Link>
        <Link to={adminPath('settings')}>
          <span>
            <Settings size={22} />
          </span>
          Ayarlar
        </Link>
      </nav>

      <section className="dm-card" aria-label="Menü sağlığı">
        <h3 className="dm-title">Menü sağlığı</h3>
        <div className="dm-health">
          <div className="dm-ring" role="img" aria-label={`Ürünlerin yüzde ${percent}'i hazır`}>
            <svg viewBox="0 0 80 80" width="92" height="92">
              <circle cx="40" cy="40" r={RADIUS} className="dm-ring__track" />
              <circle
                cx="40"
                cy="40"
                r={RADIUS}
                className="dm-ring__bar"
                strokeDasharray={CIRC}
                strokeDashoffset={ringReady ? CIRC * (1 - percent / 100) : CIRC}
              />
            </svg>
            <b>%{percent}</b>
          </div>
          <div className="dm-health__text">
            <p>
              <b>{valid}</b> / {total} ürün hazır
            </p>
            <p className="dm-health__groups">
              <span>
                <i className="is-on" /> {summary.groups.active} açık grup
              </span>
              <span>
                <i /> {summary.groups.passive} kapalı
              </span>
            </p>
          </div>
        </div>
        {invalid > 0 && (
          <Link to={adminPath('products')} className="dm-alert">
            <AlertCircle size={20} aria-hidden="true" />
            <span>
              <b>{invalid} ürün</b> eksik: görsel veya fiyat yok
            </span>
            <em>
              Düzelt <ChevronRight size={16} />
            </em>
          </Link>
        )}
      </section>

      <section className="dm-card" aria-label="En çok bakılanlar">
        <div className="dm-card__head">
          <h3 className="dm-title">En çok bakılanlar</h3>
          <Link to={adminPath('stats')} className="dm-link">
            Tümü <ChevronRight size={15} />
          </Link>
        </div>
        <div className="dm-tabs" role="tablist" aria-label="Liste türü">
          {(
            [
              ['groups', 'Gruplar'],
              ['products', 'Ürünler'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={tab === id ? 'is-active' : ''}
              onClick={() => setTab(id)}
            >
              {label}
            </button>
          ))}
        </div>
        {list.length === 0 ? (
          <p className="dm-empty">Henüz veri yok.</p>
        ) : (
          <ol className="dm-rank" key={tab}>
            {list.map((item, i) => (
              <li key={item.id} style={{ ['--i' as string]: i }}>
                <span className="dm-rank__n">{i + 1}</span>
                <div className="dm-rank__body">
                  <div className="dm-rank__row">
                    <span className="dm-rank__name">{item.name}</span>
                    <b>{item.count.toLocaleString('tr-TR')}</b>
                  </div>
                  <span className="dm-rank__bar">
                    <i style={{ width: `${(item.count / max) * 100}%` }} />
                  </span>
                </div>
              </li>
            ))}
          </ol>
        )}
      </section>

      {months.length > 0 && (
        <section className="dm-card" aria-label="Son aylar">
          <div className="dm-card__head">
            <h3 className="dm-title">Son {months.length} ay</h3>
            <span className="dm-legend">
              <i className="is-a" /> Gruplar <i className="is-b" /> Ürünler
            </span>
          </div>
          <div className="dm-months">
            {months.map((m) => (
              <div key={m.month} className="dm-months__col">
                <div className="dm-months__bars" title={`${m.gruplar} grup · ${m.urunler} ürün`}>
                  <span className="is-a" style={{ height: `${(m.gruplar / monthMax) * 100}%` }} />
                  <span className="is-b" style={{ height: `${(m.urunler / monthMax) * 100}%` }} />
                </div>
                <small>{m.label || m.month.slice(5)}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="dm-card dm-card--flush" aria-label="Takvim">
        <button
          type="button"
          className="dm-fold"
          aria-expanded={calendarOpen}
          onClick={() => setCalendarOpen((v) => !v)}
        >
          <span>
            <CalendarDays size={20} aria-hidden="true" />
            Takvim ve notlar
          </span>
          <ChevronDown size={20} className={calendarOpen ? 'is-open' : ''} aria-hidden="true" />
        </button>
        {calendarOpen && (
          <div className="dm-fold__body">
            <DashboardCalendar />
          </div>
        )}
      </section>
    </div>
  );
}

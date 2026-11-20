import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowLeft, ArrowRight, Flame, Loader2, Snowflake, TrendingDown, TrendingUp, X } from 'lucide-react';
import { PageHeading } from '@/components/ui';
import { ProductDetail, ProductList } from '@/components/admin/products/PriceHistoryExplorer';
import { api, formatMoney } from '@/lib/api';
import { adminPath } from '@/lib/adminPath';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { KIND_LABEL, formatDelta, formatShortDate, formatWhen, type Overview } from '@/lib/priceHistory';
import '@/components/admin/products/price-history.css';

const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const t = new Date();
  const diff = Math.round((new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime() - new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()) / 86_400_000);
  if (diff === 0) return 'Bugün';
  if (diff === 1) return 'Dün';
  return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' });
};

/** Menü fiyat endeksi: ilk fiyatlara göre ortalama seviye (100 = başlangıç). */
function IndexChart({ data, height }: { data: Overview['index']; height: number }) {
  const rows = data.map((p) => ({ label: formatShortDate(new Date(p.t).getTime()), value: p.value }));
  if (rows.length < 2) return null;
  const vals = rows.map((r) => r.value);
  const lo = Math.floor(Math.min(...vals, 100) - 2);
  const hi = Math.ceil(Math.max(...vals, 100) + 2);
  return (
    <div className="phc" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={rows} margin={{ top: 10, right: 12, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="phgIdx" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--admin-accent)', stopOpacity: 0.34 }} />
              <stop offset="100%" style={{ stopColor: 'var(--admin-accent)', stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 5" className="phc-grid" />
          <XAxis dataKey="label" tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={36} tickMargin={8} className="phc-axis" />
          <YAxis domain={[lo, hi]} tickLine={false} axisLine={false} width={36} className="phc-axis" />
          <ReferenceLine y={100} stroke="var(--admin-text-muted)" strokeOpacity={0.5} strokeDasharray="2 6" />
          <Tooltip
            cursor={{ stroke: 'var(--admin-accent)', strokeOpacity: 0.35, strokeDasharray: '4 4' }}
            content={({ active, payload }) =>
              active && payload?.[0] ? (
                <div className="phc-tip">
                  <small>{String(payload[0].payload.label)}</small>
                  <strong>{formatDelta(Math.round((Number(payload[0].value) - 100) * 10) / 10)} ilk fiyatlara göre</strong>
                </div>
              ) : null
            }
          />
          <Area type="monotone" dataKey="value" className="phc-area" strokeWidth={2.6} fill="url(#phgIdx)" isAnimationActive animationDuration={700} dot={false} activeDot={{ r: 6, strokeWidth: 3, stroke: 'var(--admin-card)' }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

function Mover({ m, tone, onOpen }: { m: Overview['movers']['up'][number]; tone: 'up' | 'down'; onOpen: (id: number) => void }) {
  return (
    <button type="button" className={`phg-mover is-${tone}`} onClick={() => onOpen(m.productId)}>
      <span className="phg-mover__ico" aria-hidden>
        {tone === 'up' ? <Flame size={16} /> : <Snowflake size={16} />}
      </span>
      <span className="phg-mover__name">{m.name}</span>
      <b>{formatDelta(m.deltaPct)}</b>
    </button>
  );
}

function Feed({ items, onOpen }: { items: Overview['recent']; onOpen: (id: number) => void }) {
  const groups = useMemo(() => {
    const out: { label: string; rows: Overview['recent'] }[] = [];
    for (const r of items) {
      const label = dayLabel(r.at);
      const last = out[out.length - 1];
      if (last && last.label === label) last.rows.push(r);
      else out.push({ label, rows: [r] });
    }
    return out;
  }, [items]);
  if (!items.length) return <p className="phx-note">Henüz hareket yok.</p>;
  return (
    <div className="phg-feed">
      {groups.map((g) => (
        <section key={g.label}>
          <h4>{g.label}</h4>
          <ul>
            {g.rows.map((r) => {
              const up = r.newPrice >= r.oldPrice;
              return (
                <li key={`${r.changeId}-${r.productId}`}>
                  <button type="button" onClick={() => onOpen(r.productId)}>
                    <span className={`phx-log__dot ${up ? 'is-up' : 'is-down'}`} aria-hidden>
                      {up ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                    </span>
                    <span className="phg-feed__main">
                      <strong>{r.name}</strong>
                      <small>
                        {formatMoney(r.oldPrice, { symbol: '' }).trim()} <ArrowRight size={10} aria-hidden /> {formatMoney(r.newPrice, { symbol: '' }).trim()} · {KIND_LABEL[r.kind] ?? r.kind} · {r.userName}
                      </small>
                    </span>
                    <time>{formatWhen(r.at).replace(/^Bugün |^Dün /, '')}</time>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/**
 * Ürün bazlı fiyat geçmişi. Geniş ekranda pano (endeks + öne çıkanlar + liste + hareketler, ayrıntı sağdan açılır),
 * telefonda tek sütun (özet kart, sekmeler, ayrıntı alttan açılan tam sayfa).
 */
export default function PriceHistoryPage() {
  const navigate = useNavigate();
  const wide = useMediaQuery('(min-width: 1000px)');
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<number | null>(null);
  const [tab, setTab] = useState<'products' | 'feed'>('products');

  useEffect(() => {
    let alive = true;
    api<Overview>('/api/admin/products/price-history/overview')
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (open == null) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(null);
    window.addEventListener('keydown', key);
    const prev = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.documentElement.style.overflow = prev;
    };
  }, [open]);

  const latest = data?.index.length ? data.index[data.index.length - 1].value : 100;
  const total = Math.round((latest - 100) * 10) / 10;
  const maxAct = Math.max(1, ...(data?.activity.map((a) => a.changes) ?? [1]));
  const empty = data != null && data.totals.products === 0;

  return (
    <section className="phg" aria-label="Fiyat geçmişi">
      <header className="phg-head">
        <button type="button" className="aphp-back" onClick={() => navigate(adminPath('products'))}>
          <ArrowLeft size={18} aria-hidden="true" /> Ürünlere dön
        </button>
        <PageHeading title="Fiyat geçmişi" subtitle="Menünün fiyatları zaman içinde nasıl değişti?" />
      </header>

      {error ? <p className="phx-note">Fiyat geçmişi yüklenemedi. Sayfayı yenileyip tekrar deneyin.</p> : null}
      {!data && !error ? (
        <p className="phx-note">
          <Loader2 size={16} className="phx-spin" aria-hidden /> Yükleniyor…
        </p>
      ) : null}

      {empty ? (
        <div className="phg-empty">
          <TrendingUp size={30} aria-hidden />
          <h3>Henüz fiyatı değişen ürün yok</h3>
          <p>Toplu zam/indirim yaptığında ya da bir ürünün fiyatını düzenlediğinde burada grafikleri ve hareketleri göreceksin.</p>
        </div>
      ) : null}

      {data && !empty ? (
        <>
          <div className="phg-hero">
            <article className="phg-index">
              <div className="phg-index__top">
                <div>
                  <small>Menü fiyat endeksi</small>
                  <strong className={total > 0 ? 'is-up' : total < 0 ? 'is-down' : ''}>{formatDelta(total)}</strong>
                  <em>ilk fiyatlara göre ortalama</em>
                </div>
                <div className="phg-kpis">
                  <span>
                    <b>{data.totals.changes}</b> işlem
                  </span>
                  <span>
                    <b>{data.totals.products}</b> ürün
                  </span>
                </div>
              </div>
              <IndexChart data={data.index} height={wide ? 210 : 120} />
            </article>

            <article className="phg-act">
              <small>Son 14 gün</small>
              <div className="phg-bars" role="img" aria-label="Son 14 günün fiyat işlemleri">
                {data.activity.map((a, i) => (
                  <i key={a.day} className={i === data.activity.length - 1 ? 'is-today' : ''} title={`${formatShortDate(new Date(a.day).getTime())}: ${a.changes} işlem`} style={{ height: `${a.changes ? 12 + (a.changes / maxAct) * 88 : 6}%` }} />
                ))}
              </div>
              <div className="phg-act__ends">
                <span>{formatShortDate(new Date(data.activity[0].day).getTime())}</span>
                <span>Bugün</span>
              </div>
            </article>
          </div>

          {data.movers.up.length || data.movers.down.length ? (
            <div className="phg-movers">
              {data.movers.up.length ? (
                <div>
                  <h4>
                    <Flame size={15} aria-hidden /> En çok artanlar
                  </h4>
                  <div className="phg-movers__row">
                    {data.movers.up.map((m) => (
                      <Mover key={m.productId} m={m} tone="up" onOpen={setOpen} />
                    ))}
                  </div>
                </div>
              ) : null}
              {data.movers.down.length ? (
                <div>
                  <h4>
                    <Snowflake size={15} aria-hidden /> En çok düşenler
                  </h4>
                  <div className="phg-movers__row">
                    {data.movers.down.map((m) => (
                      <Mover key={m.productId} m={m} tone="down" onOpen={setOpen} />
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {!wide ? (
            <div className="phg-tabs" role="tablist" aria-label="Görünüm">
              <button type="button" role="tab" aria-selected={tab === 'products'} onClick={() => setTab('products')}>
                Ürünler
              </button>
              <button type="button" role="tab" aria-selected={tab === 'feed'} onClick={() => setTab('feed')}>
                Hareketler
              </button>
            </div>
          ) : null}

          <div className="phg-board">
            {wide || tab === 'products' ? (
              <div className="phg-board__list">
                {wide ? <h3>Ürünler</h3> : null}
                <ProductList compact={false} selectedId={open} onSelect={(it) => setOpen(it.productId)} />
              </div>
            ) : null}
            {wide || tab === 'feed' ? (
              <div className="phg-board__feed">
                {wide ? <h3>Son hareketler</h3> : null}
                <Feed items={data.recent} onOpen={setOpen} />
              </div>
            ) : null}
          </div>
        </>
      ) : null}

      {/* ayrıntı: geniş ekranda sağdan, telefonda alttan açılır. Kapatmak için X veya Esc. */}
      {open != null ? (
        <div className="phg-layer" role="dialog" aria-modal="true" aria-label="Ürün fiyat ayrıntısı">
          <div className="phg-scrim" aria-hidden="true" />
          <aside className="phg-sheet">
            <span className="phg-grab" aria-hidden="true" />
            <button type="button" className="phg-x" onClick={() => setOpen(null)} aria-label="Ayrıntıyı kapat">
              <X size={19} aria-hidden />
            </button>
            <div className="phg-sheet__body">
              <ProductDetail productId={open} compact={false} />
            </div>
          </aside>
        </div>
      ) : null}
    </section>
  );
}

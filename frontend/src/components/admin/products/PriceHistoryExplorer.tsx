import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ArrowUpRight, Loader2, Package, Search, TrendingDown, TrendingUp } from 'lucide-react';
import { api, formatMoney, imageUrl } from '@/lib/api';
import {
  KIND_LABEL,
  RANGES,
  SORT_LABELS,
  buildChartData,
  formatDelta,
  formatShortDate,
  formatWhen,
  priceStats,
  type HistorySort,
  type ProductHistory,
  type ProductHistoryItem,
  type RangeId,
} from '@/lib/priceHistory';
import PriceChart from './PriceChart';
import './price-history.css';

const PAGE = 30;

function Thumb({ item }: { item: { imageUrl: string | null; name: string } }) {
  const [broken, setBroken] = useState(false);
  return item.imageUrl && !broken ? (
    <img className="phx-thumb" src={imageUrl(item.imageUrl)} alt="" loading="lazy" data-no-fit onError={() => setBroken(true)} />
  ) : (
    <span className="phx-thumb phx-thumb--empty" aria-hidden>
      <Package size={16} />
    </span>
  );
}

function Delta({ pct }: { pct: number }) {
  return (
    <span className={`phx-delta ${pct > 0 ? 'is-up' : pct < 0 ? 'is-down' : ''}`}>
      {pct > 0 ? <TrendingUp size={12} aria-hidden /> : pct < 0 ? <TrendingDown size={12} aria-hidden /> : null}
      {formatDelta(pct)}
    </span>
  );
}

/** Ürün listesi: arama, sıralama ve "daha fazla" ile sayfalanır; binlerce ürün olsa da ekranı doldurmaz. */
function ProductList({
  selectedId,
  onSelect,
  compact,
  onLoaded,
}: {
  selectedId: number | null;
  onSelect: (item: ProductHistoryItem) => void;
  compact: boolean;
  onLoaded?: (first: ProductHistoryItem | null) => void;
}) {
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<HistorySort>('recent');
  const [items, setItems] = useState<ProductHistoryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const seq = useRef(0);

  const load = useCallback(
    async (offset: number, query: string, order: HistorySort) => {
      const my = ++seq.current;
      setLoading(true);
      setError(false);
      try {
        const params = new URLSearchParams({ q: query, sort: order, limit: String(PAGE), offset: String(offset) });
        const res = await api<{ total: number; products: ProductHistoryItem[] }>(`/api/admin/products/price-history/products?${params}`);
        if (my !== seq.current) return;
        setTotal(res.total);
        setItems((prev) => (offset ? [...prev, ...res.products] : res.products));
        if (!offset) onLoaded?.(res.products[0] ?? null);
      } catch {
        if (my === seq.current) setError(true);
      } finally {
        if (my === seq.current) setLoading(false);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void load(0, q.trim(), sort), q ? 250 : 0);
    return () => window.clearTimeout(t);
  }, [q, sort, load]);

  return (
    <div className={`phx-list${compact ? ' is-compact' : ''}`}>
      <label className="phx-search">
        <Search size={16} aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ürün ara…" aria-label="Ürün ara" />
      </label>
      <div className="phx-sorts" role="group" aria-label="Sıralama">
        {(Object.keys(SORT_LABELS) as HistorySort[]).map((s) => (
          <button key={s} type="button" aria-pressed={sort === s} onClick={() => setSort(s)}>
            {SORT_LABELS[s]}
          </button>
        ))}
      </div>
      {error ? (
        <p className="phx-note">
          Liste yüklenemedi. <button type="button" onClick={() => void load(0, q.trim(), sort)}>Tekrar dene</button>
        </p>
      ) : null}
      <ul className="phx-items">
        {items.map((it) => (
          <li key={it.productId}>
            <button type="button" aria-current={selectedId === it.productId ? 'true' : undefined} onClick={() => onSelect(it)}>
              <Thumb item={it} />
              <span className="phx-items__main">
                <strong>{it.name}</strong>
                <small>
                  {it.changes} değişiklik · {formatWhen(it.lastChangeAt)}
                </small>
              </span>
              <span className="phx-items__side">
                <b>{formatMoney(it.currentPrice ?? it.lastPrice, { symbol: it.symbol })}</b>
                <Delta pct={it.deltaPct} />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {!items.length && !loading && !error ? (
        <p className="phx-note">{q ? 'Bu aramaya uyan ürün yok.' : 'Henüz fiyatı değişen ürün yok. Toplu işlem yaptığınızda veya bir ürünün fiyatını düzenlediğinizde burada görünür.'}</p>
      ) : null}
      {loading ? (
        <p className="phx-note">
          <Loader2 size={16} className="phx-spin" aria-hidden /> Yükleniyor…
        </p>
      ) : items.length < total ? (
        <button type="button" className="phx-more" onClick={() => void load(items.length, q.trim(), sort)}>
          Daha fazla göster ({total - items.length})
        </button>
      ) : null}
    </div>
  );
}

function Stat({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'up' | 'down' }) {
  return (
    <div className={`phx-stat${tone ? ` is-${tone}` : ''}`}>
      <small>{label}</small>
      <strong>{value}</strong>
      {hint ? <em>{hint}</em> : null}
    </div>
  );
}

/** Bir ürünün fiyat seyri: özet kartları, aralık seçimi, grafik ve değişiklik kayıtları. */
function ProductDetail({ productId, compact, onBack }: { productId: number; compact: boolean; onBack?: () => void }) {
  const [data, setData] = useState<ProductHistory | null>(null);
  const [error, setError] = useState(false);
  const [range, setRange] = useState<RangeId>('all');

  useEffect(() => {
    let alive = true;
    setData(null);
    setError(false);
    api<ProductHistory>(`/api/admin/products/${productId}/price-history`)
      .then((r) => alive && setData(r))
      .catch(() => alive && setError(true));
    return () => {
      alive = false;
    };
  }, [productId]);

  const stats = useMemo(() => (data ? priceStats(data.points, data.product.currentPrice) : null), [data]);
  const chart = useMemo(() => (data ? buildChartData(data.points, range, data.product.createdAt) : []), [data, range]);
  const log = useMemo(() => (data ? [...data.points].reverse() : []), [data]);

  if (error) return <p className="phx-note">Fiyat geçmişi yüklenemedi.</p>;
  if (!data || !stats) {
    return (
      <p className="phx-note">
        <Loader2 size={16} className="phx-spin" aria-hidden /> Yükleniyor…
      </p>
    );
  }
  const { product } = data;
  const sym = product.symbol;
  const money = (v: number) => formatMoney(v, { symbol: sym });

  return (
    <div className="phx-detail">
      <header className="phx-detail__head">
        {onBack ? (
          <button type="button" className="phx-back" onClick={onBack} aria-label="Ürün listesine dön">
            <ArrowLeft size={18} />
          </button>
        ) : null}
        <Thumb item={{ imageUrl: product.imageUrl, name: product.name }} />
        <div>
          <h3>{product.name}</h3>
          <p>
            {product.exists ? 'Şu anki fiyat' : 'Silinmiş ürün · son fiyat'} <b>{money(stats.current)}</b> <Delta pct={stats.deltaPct} />
          </p>
        </div>
      </header>

      <div className="phx-stats">
        <Stat label="İlk fiyat" value={money(stats.first)} hint={formatShortDate(new Date(data.points[0].at).getTime(), true)} />
        <Stat label="En yüksek" value={money(stats.max.price)} hint={formatShortDate(stats.max.at, true)} tone="up" />
        <Stat label="En düşük" value={money(stats.min.price)} hint={formatShortDate(stats.min.at, true)} tone="down" />
        <Stat label="Değişiklik" value={String(stats.changes)} hint={stats.lastAt ? `Son: ${formatShortDate(stats.lastAt, true)}` : undefined} />
      </div>

      <div className="phx-chartbox">
        <div className="phx-ranges" role="group" aria-label="Zaman aralığı">
          {RANGES.map((r) => (
            <button key={r.id} type="button" aria-pressed={range === r.id} onClick={() => setRange(r.id)}>
              {r.label}
            </button>
          ))}
          <span className="phx-legend">
            <i className="is-up" /> Artış <i className="is-down" /> Düşüş
          </span>
        </div>
        <PriceChart data={chart} symbol={sym} height={compact ? 220 : 340} currentPrice={product.exists ? product.currentPrice : null} />
      </div>

      <h4 className="phx-sub">Tüm değişiklikler</h4>
      <ol className="phx-log">
        {log.map((p) => {
          const delta = p.oldPrice > 0 ? Math.round(((p.newPrice - p.oldPrice) / p.oldPrice) * 1000) / 10 : 0;
          return (
            <li key={`${p.changeId}-${p.at}`}>
              <span className={`phx-log__dot ${delta >= 0 ? 'is-up' : 'is-down'}`} aria-hidden>
                {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
              </span>
              <div>
                <strong>
                  {money(p.oldPrice)} <ArrowRight size={12} aria-hidden /> {money(p.newPrice)}
                </strong>
                <small>
                  {KIND_LABEL[p.kind] ?? p.kind} · {p.userName} · {formatWhen(p.at)}
                </small>
                {p.kind !== 'manual' ? <small className="phx-log__sum">{p.summary}</small> : null}
              </div>
              <Delta pct={delta} />
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/**
 * Ürün bazlı fiyat geçmişi gezgini.
 * - page: solda ürün listesi, sağda ayrıntı; telefonda önce liste, seçince ayrıntı (geri düğmesiyle).
 * - side: modalın yanındaki panel; üstte kısa ürün listesi, altta grafik.
 */
export default function PriceHistoryExplorer({
  variant,
  onOpenFull,
}: {
  variant: 'page' | 'side';
  /** side: "Tüm ürünleri gör" düğmesi */
  onOpenFull?: () => void;
}) {
  const [selected, setSelected] = useState<number | null>(null);
  const [mobileDetail, setMobileDetail] = useState(false);
  const picked = useRef(false);
  const compact = variant === 'side';

  const select = (it: ProductHistoryItem) => {
    setSelected(it.productId);
    setMobileDetail(true);
  };

  if (compact) {
    return (
      <div className="phx phx--side">
        {selected == null || !mobileDetail ? (
          <ProductList
            compact
            selectedId={selected}
            onSelect={select}
            onLoaded={(first) => {
              // Panel açılır açılmaz en son değişen ürünün grafiği görünsün (yalnızca ilk yüklemede).
              if (picked.current || !first) return;
              picked.current = true;
              setSelected(first.productId);
              setMobileDetail(true);
            }}
          />
        ) : null}
        {selected != null && mobileDetail ? <ProductDetail productId={selected} compact onBack={() => setMobileDetail(false)} /> : null}
        {onOpenFull ? (
          <button type="button" className="phx-full" onClick={onOpenFull}>
            Tüm ürünlerin geçmişi <ArrowUpRight size={15} aria-hidden />
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className={`phx phx--page${mobileDetail ? ' is-detail' : ''}`}>
      <aside className="phx-pane phx-pane--list">
        <ProductList
          compact={false}
          selectedId={selected}
          onSelect={select}
          onLoaded={(first) => {
            if (window.matchMedia('(min-width: 900px)').matches) setSelected((s) => s ?? first?.productId ?? null);
          }}
        />
      </aside>
      <section className="phx-pane phx-pane--detail">
        {selected != null ? (
          <ProductDetail productId={selected} compact={false} onBack={() => setMobileDetail(false)} />
        ) : (
          <p className="phx-note">Soldan bir ürün seçin; fiyatının zaman içindeki seyrini burada görün.</p>
        )}
      </section>
    </div>
  );
}

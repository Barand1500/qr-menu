import { useId, useMemo } from 'react';
import { Area, AreaChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/api';
import { KIND_LABEL, formatShortDate, type ChartDatum } from '@/lib/priceHistory';

const UP = '#f97316';
const DOWN = '#10b981';

type DotProps = { cx?: number; cy?: number; payload?: ChartDatum };

function Dot({ cx, cy, payload }: DotProps) {
  if (!payload?.point || cx == null || cy == null) return <g />;
  const color = payload.up ? UP : DOWN;
  return (
    <g>
      <circle cx={cx} cy={cy} r={9} fill={color} opacity={0.18} />
      <circle cx={cx} cy={cy} r={5} fill={color} stroke="var(--admin-card)" strokeWidth={2} />
    </g>
  );
}

function TipBody({ active, payload, symbol }: { active?: boolean; payload?: { payload: ChartDatum }[]; symbol: string }) {
  const d = payload?.[0]?.payload;
  if (!active || !d) return null;
  const p = d.point;
  const delta = p && p.oldPrice > 0 ? ((p.newPrice - p.oldPrice) / p.oldPrice) * 100 : 0;
  return (
    <div className="phc-tip">
      <small>{new Date(d.t).toLocaleString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</small>
      {p ? (
        <>
          <strong>
            {formatMoney(p.oldPrice, { symbol })} <span aria-hidden>→</span> {formatMoney(p.newPrice, { symbol })}
          </strong>
          <em className={d.up ? 'is-up' : 'is-down'}>
            {d.up ? '▲' : '▼'} {delta > 0 ? '+' : '−'}%{Math.abs(delta).toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
          </em>
          <span>
            {KIND_LABEL[p.kind] ?? p.kind} · {p.userName}
          </span>
          <span className="phc-tip__sum">{p.summary}</span>
        </>
      ) : (
        <strong>{formatMoney(d.price, { symbol })}</strong>
      )}
    </div>
  );
}

/** Fiyatın zaman içindeki seyri: basamaklı alan grafiği; her değişiklik yukarı (turuncu) / aşağı (yeşil) nokta. */
export default function PriceChart({
  data,
  symbol,
  height = 260,
  currentPrice,
}: {
  data: ChartDatum[];
  symbol: string;
  height?: number;
  currentPrice?: number | null;
}) {
  const gid = useId().replace(/:/g, '');
  const [lo, hi] = useMemo(() => {
    const prices = data.map((d) => d.price);
    if (currentPrice != null) prices.push(currentPrice);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const pad = Math.max((max - min) * 0.18, max * 0.04, 1);
    return [Math.max(0, Math.floor(min - pad)), Math.ceil(max + pad)];
  }, [data, currentPrice]);
  if (data.length < 2) return <p className="phc-empty">Bu aralıkta gösterilecek değişiklik yok.</p>;
  const multiYear = new Date(data[0].t).getFullYear() !== new Date(data[data.length - 1].t).getFullYear();

  return (
    <div className="phc" style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 14, right: 14, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id={`g${gid}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: 'var(--admin-accent)', stopOpacity: 0.34 }} />
              <stop offset="100%" style={{ stopColor: 'var(--admin-accent)', stopOpacity: 0.02 }} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} strokeDasharray="3 5" className="phc-grid" />
          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(t: number) => formatShortDate(t, multiYear)}
            tickLine={false}
            axisLine={false}
            minTickGap={42}
            tickMargin={8}
            className="phc-axis"
          />
          <YAxis
            domain={[lo, hi]}
            tickFormatter={(v: number) => v.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}
            tickLine={false}
            axisLine={false}
            width={44}
            className="phc-axis"
          />
          <Tooltip content={<TipBody symbol={symbol} />} cursor={{ stroke: 'var(--admin-accent)', strokeOpacity: 0.35, strokeDasharray: '4 4' }} />
          {currentPrice != null ? <ReferenceLine y={currentPrice} stroke="var(--admin-text-muted)" strokeOpacity={0.5} strokeDasharray="2 6" /> : null}
          <Area
            type="stepAfter"
            dataKey="price"
            className="phc-area"
            strokeWidth={2.6}
            fill={`url(#g${gid})`}
            dot={<Dot />}
            activeDot={{ r: 7, strokeWidth: 3, stroke: 'var(--admin-card)' }}
            isAnimationActive
            animationDuration={650}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

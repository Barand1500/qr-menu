import { useId } from 'react';

/** Mini fiyat grafiği: yönü renkten anlaşılır (artış turuncu, düşüş yeşil, sabit gri). */
export default function PriceSpark({ values, width = 64, height = 26 }: { values: number[]; width?: number; height?: number }) {
  const gid = useId().replace(/:/g, '');
  if (values.length < 2) return <span className="phx-spark" style={{ width, height }} aria-hidden="true" />;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const x = (i: number) => pad + (i / (values.length - 1)) * (width - pad * 2);
  const y = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  // basamaklı çizgi: fiyat bir sonraki değişikliğe kadar sabit kalır
  let d = `M${x(0)},${y(values[0])}`;
  for (let i = 1; i < values.length; i++) d += ` H${x(i)} V${y(values[i])}`;
  const trend = values[values.length - 1] - values[0];
  const color = trend > 0 ? '#f97316' : trend < 0 ? '#10b981' : '#94a3b8';
  return (
    <svg className="phx-spark" width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <defs>
        <linearGradient id={`s${gid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={color} stopOpacity="0.28" />
          <stop offset="1" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d} V${height} H${x(0)} Z`} fill={`url(#s${gid})`} />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={x(values.length - 1)} cy={y(values[values.length - 1])} r="2.6" fill={color} />
    </svg>
  );
}

import type { CSSProperties, MouseEvent } from 'react';

export const MINIMAP_ZOOM = 16;

/** Enlem/boylamın harita karosu koordinatı (kesirli). */
export function tilePosition(lat: number, lng: number, zoom = MINIMAP_ZOOM) {
  const n = 2 ** zoom;
  const x = ((lng + 180) / 360) * n;
  const r = (lat * Math.PI) / 180;
  const y = ((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * n;
  return { x, y };
}

/** Kartın içine gömülen küçük, dokunmatik olmayan harita: karolar + iğne. 3B çevirmeyle sorunsuz çalışır. */
export default function ContactMiniMap({
  lat,
  lng,
  href,
  label,
}: {
  lat: number;
  lng: number;
  href: string;
  label: string;
}) {
  const { x, y } = tilePosition(lat, lng);
  const tx = Math.floor(x);
  const ty = Math.floor(y);
  const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
  const tiles: { key: string; col: number; row: number; src: string }[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 5; col++) {
      tiles.push({
        key: `${col}-${row}`,
        col,
        row,
        src: `${base}/api/map-tiles/${MINIMAP_ZOOM}/${tx - 2 + col}/${ty - 1 + row}.png`,
      });
    }
  }
  const style = { '--fx': x - tx, '--fy': y - ty } as CSSProperties;
  return (
    <a
      className="cc-minimap"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      style={style}
      // Karta dokununca çevrilir; haritaya dokununca yalnızca yol tarifi açılır
      onClick={(e: MouseEvent) => e.stopPropagation()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      <span className="cc-minimap__tiles" aria-hidden="true">
        {tiles.map((t) => (
          <img
            key={t.key}
            src={t.src}
            alt=""
            draggable={false}
            loading="lazy"
            data-no-fit
            style={{ left: `calc(var(--cc-tile) * ${t.col})`, top: `calc(var(--cc-tile) * ${t.row})` }}
          />
        ))}
      </span>
      <i className="cc-minimap__pin" aria-hidden="true" />
      <small>{label} · © OpenStreetMap</small>
    </a>
  );
}

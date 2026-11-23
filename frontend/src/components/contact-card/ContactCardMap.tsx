import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation } from 'lucide-react';
import { pinIcon } from './mapPin';

/** Müşteri sayfasındaki konum haritası (iğne + Yol tarifi). Sayfada tembel yüklenir. */
export default function ContactCardMap({
  lat,
  lng,
  href,
  label,
  hint,
  actionLabel,
}: {
  lat: number;
  lng: number;
  href: string;
  label: string;
  hint: string;
  actionLabel: string;
}) {
  const host = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!host.current) return;
    const m = L.map(host.current, {
      center: [lat, lng],
      zoom: 16,
      zoomControl: true,
      scrollWheelZoom: false, // sayfa kaydırılırken harita yakınlaşmasın
      dragging: !L.Browser.mobile, // telefonda tek parmak sayfayı kaydırır; iki parmakla yakınlaşılır
    });
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    L.tileLayer(`${base}/api/map-tiles/{z}/{x}/{y}.png`, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    L.marker([lat, lng], { icon: pinIcon, keyboard: false }).addTo(m);
    const t = window.setTimeout(() => m.invalidateSize(), 150);
    return () => {
      window.clearTimeout(t);
      m.remove();
    };
  }, [lat, lng]);

  return (
    <section className="cc-map" aria-label={label}>
      <div className="cc-map__canvas" ref={host} />
      <div className="cc-map__bar">
        <div>
          <small>{label}</small>
          <strong>{hint}</strong>
        </div>
        <a href={href} target="_blank" rel="noopener noreferrer">
          <Navigation size={16} aria-hidden="true" /> {actionLabel}
        </a>
      </div>
    </section>
  );
}

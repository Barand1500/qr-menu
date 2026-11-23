import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Home, MapPinOff, Search } from 'lucide-react';
import { api } from '@/lib/api';
import { pinIcon } from './mapPin';

type Hit = { label: string; lat: number; lng: number };
type Point = { lat: number; lng: number };

const FALLBACK: Point = { lat: 41.0082, lng: 28.9784 };

/** Yönetimde konum seçici: adres ara ya da haritaya dokun; iğne sürüklenebilir. */
export default function ContactMapPicker({
  lat,
  lng,
  home,
  onChange,
  disabled = false,
}: {
  lat: number | null;
  lng: number | null;
  /** Konum izni (Geo-Lock) için kayıtlı nokta: varsa tek dokunuşla kullanılır */
  home: Point | null;
  /** label: yalnızca aramadan seçilince dolu gelir (elle taşıma yer adını sıfırlar) */
  onChange: (point: Point | null, label?: string) => void;
  disabled?: boolean;
}) {
  const host = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const marker = useRef<L.Marker | null>(null);
  const change = useRef(onChange);
  change.current = onChange;
  const lock = useRef(disabled);
  lock.current = disabled;
  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<Hit[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState('');
  const has = typeof lat === 'number' && typeof lng === 'number';

  // İğneyi oluşturur; sürüklenince yeni konumu bildirir
  function ensureMarker(m: L.Map, p: L.LatLngExpression) {
    if (marker.current) {
      marker.current.setLatLng(p);
      return;
    }
    const mk = L.marker(p, { draggable: true, icon: pinIcon }).addTo(m);
    mk.on('dragend', () => {
      const q = mk.getLatLng();
      change.current({ lat: Number(q.lat.toFixed(6)), lng: Number(q.lng.toFixed(6)) });
    });
    marker.current = mk;
  }

  useEffect(() => {
    if (!host.current || map.current) return;
    const start = has ? { lat: lat as number, lng: lng as number } : home || FALLBACK;
    const m = L.map(host.current, { center: [start.lat, start.lng], zoom: has ? 17 : home ? 15 : 11, zoomControl: true });
    const base = (import.meta.env.VITE_API_URL || '').replace(/\/$/, '');
    L.tileLayer(`${base}/api/map-tiles/{z}/{x}/{y}.png`, {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(m);
    if (has) ensureMarker(m, [lat as number, lng as number]);
    m.on('click', (e: L.LeafletMouseEvent) => {
      if (lock.current) return;
      change.current({ lat: Number(e.latlng.lat.toFixed(6)), lng: Number(e.latlng.lng.toFixed(6)) });
    });
    map.current = m;
    const t = window.setTimeout(() => m.invalidateSize(), 120);
    return () => {
      window.clearTimeout(t);
      m.remove();
      map.current = null;
      marker.current = null;
    };
    // yalnızca bir kez kurulur
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Dışarıdan değişince (arama sonucu, kaldır, konum izni noktası, harita tıklaması) iğneyi eşitle
  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (has) {
      const p = L.latLng(lat as number, lng as number);
      ensureMarker(m, p);
      if (!m.getBounds().contains(p)) m.setView(p, Math.max(m.getZoom(), 16));
    } else if (marker.current) {
      marker.current.remove();
      marker.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [has, lat, lng]);

  async function search() {
    const q = query.trim();
    if (q.length < 2 || searching) return;
    setSearching(true);
    setError('');
    try {
      const res = await api<Hit[]>(`/api/admin/settings/geo-search?q=${encodeURIComponent(q)}`);
      setHits(res);
      if (!res.length) setError('Sonuç bulunamadı. Daha kısa yazmayı veya haritaya dokunmayı deneyin.');
      else if (res.length === 1) pick(res[0]);
    } catch {
      setHits([]);
      setError('Arama şu an yapılamıyor. Haritaya dokunarak konumu seçebilir veya bağlantı yapıştırabilirsiniz.');
    } finally {
      setSearching(false);
    }
  }

  function pick(hit: Hit) {
    const p = { lat: Number(hit.lat.toFixed(6)), lng: Number(hit.lng.toFixed(6)) };
    setHits([]);
    setQuery(hit.label.split(',').slice(0, 3).join(','));
    change.current(p, hit.label.split(',').slice(0, 4).join(',').trim());
    map.current?.setView([p.lat, p.lng], 17);
  }

  return (
    <div className="ccp-map">
      <div className="ccp-map__search">
        <label>
          <Search size={16} aria-hidden="true" />
          <input
            type="search"
            value={query}
            placeholder="Adres veya mekân adı ara"
            maxLength={120}
            disabled={disabled}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void search();
              }
            }}
          />
        </label>
        <button type="button" onClick={() => void search()} disabled={disabled || searching || query.trim().length < 2}>
          {searching ? '…' : 'Bul'}
        </button>
      </div>
      {hits.length > 1 ? (
        <ul className="ccp-map__hits">
          {hits.map((h, i) => (
            <li key={i}>
              <button type="button" onClick={() => pick(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      {error ? <p className="ccp-map__error">{error}</p> : null}

      <div className="ccp-map__canvas">
        <div ref={host} />
        {!has ? <span className="ccp-map__hint">Arayın ya da haritaya dokunarak iğneyi bırakın</span> : null}
      </div>

      <div className="ccp-map__bar">
        <span>{has ? 'İğneyi sürükleyerek ince ayar yapabilirsiniz.' : 'Konum seçilmedi.'}</span>
        <div>
          {home ? (
            <button type="button" disabled={disabled} onClick={() => change.current(home)}>
              <Home size={15} aria-hidden="true" /> Konum izni noktası
            </button>
          ) : null}
          {has ? (
            <button type="button" disabled={disabled} onClick={() => change.current(null)}>
              <MapPinOff size={15} aria-hidden="true" /> Kaldır
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

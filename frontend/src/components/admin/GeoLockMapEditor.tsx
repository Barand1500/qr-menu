import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Check, House, Search } from 'lucide-react';
import { api } from '@/lib/api';
import type { GeoLockConfig } from '@/lib/geoLock';
import '@/geo-lock.css';

type SearchHit = { label: string; lat: number; lng: number };

type Props = {
  value: GeoLockConfig;
  onChange: (next: GeoLockConfig) => void;
};

const homeIcon = L.divIcon({
  className: '',
  html: `<div class="geo-lock-admin__home-icon" aria-hidden="true">
    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
  </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

export default function GeoLockMapEditor({ value, onChange }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const mapObj = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const circleRef = useRef<L.Circle | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const valueRef = useRef(value);
  valueRef.current = value;

  const [query, setQuery] = useState('');
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [savingHome, setSavingHome] = useState(false);
  const [homeSaved, setHomeSaved] = useState(false);

  useEffect(() => {
    if (!mapRef.current || mapObj.current) return;

    const map = L.map(mapRef.current, {
      center: [value.lat, value.lng],
      zoom: 16,
      zoomControl: true,
    });

    // OSM.org tile sunucusu Referer zorunlu kılıyor; CloudPanel no-referrer ile 403 verir.
    // Carto Voyager: OSM verisi + Referer istemez, watermark yok.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      subdomains: 'abcd',
      maxZoom: 20,
    }).addTo(map);

    const marker = L.marker([value.lat, value.lng], {
      draggable: true,
      icon: homeIcon,
    }).addTo(map);

    const circle = L.circle([value.lat, value.lng], {
      radius: value.radiusMeters,
      color: '#8a5a2b',
      weight: 2,
      fillColor: '#b07a45',
      fillOpacity: 0.18,
    }).addTo(map);

    marker.on('drag', () => {
      const p = marker.getLatLng();
      circle.setLatLng(p);
    });

    marker.on('dragend', () => {
      const p = marker.getLatLng();
      setHomeSaved(false);
      onChangeRef.current({
        ...valueRef.current,
        lat: Number(p.lat.toFixed(6)),
        lng: Number(p.lng.toFixed(6)),
      });
    });

    mapObj.current = map;
    markerRef.current = marker;
    circleRef.current = circle;

    const t1 = window.setTimeout(() => map.invalidateSize(), 80);
    const t2 = window.setTimeout(() => map.invalidateSize(), 400);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
      map.remove();
      mapObj.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
    // mount once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const map = mapObj.current;
    const marker = markerRef.current;
    const circle = circleRef.current;
    if (!map || !marker || !circle) return;
    const next = L.latLng(value.lat, value.lng);
    const cur = marker.getLatLng();
    if (Math.abs(cur.lat - next.lat) > 1e-6 || Math.abs(cur.lng - next.lng) > 1e-6) {
      marker.setLatLng(next);
      circle.setLatLng(next);
      map.panTo(next);
    }
    if (circle.getRadius() !== value.radiusMeters) {
      circle.setRadius(value.radiusMeters);
    }
  }, [value.lat, value.lng, value.radiusMeters]);

  async function runSearch() {
    const q = query.trim();
    if (q.length < 2) return;
    setSearching(true);
    try {
      const res = await api<SearchHit[]>(
        `/api/admin/settings/geo-search?q=${encodeURIComponent(q)}`
      );
      setHits(res);
      if (res[0]) applyHit(res[0]);
    } catch {
      setHits([]);
    } finally {
      setSearching(false);
    }
  }

  function applyHit(hit: SearchHit) {
    onChange({
      ...value,
      lat: Number(hit.lat.toFixed(6)),
      lng: Number(hit.lng.toFixed(6)),
    });
    setHits([]);
    setQuery(hit.label);
    mapObj.current?.setView([hit.lat, hit.lng], 17);
    setHomeSaved(false);
  }

  function goHome() {
    const map = mapObj.current;
    if (!map) return;
    map.flyTo([value.lat, value.lng], 17, { duration: 0.7 });
  }

  async function saveHome() {
    setSavingHome(true);
    try {
      await api('/api/admin/settings/geo-lock', {
        method: 'PUT',
        body: JSON.stringify(value),
      });
      setHomeSaved(true);
      window.setTimeout(() => setHomeSaved(false), 1800);
    } finally {
      setSavingHome(false);
    }
  }

  return (
    <div className="geo-lock-admin geo-lock-admin--editor">
      <div className="geo-lock-admin__search">
        <label className="geo-lock-admin__search-shell">
          <span className="geo-lock-admin__search-label">Bölge ara</span>
          <input
            type="search"
            className="geo-lock-admin__search-input"
            placeholder="Örn. Mersin Toroslar"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                void runSearch();
              }
            }}
          />
          <button
            type="button"
            className="geo-lock-admin__search-btn"
            disabled={searching || query.trim().length < 2}
            onClick={() => void runSearch()}
          >
            <Search className="w-4 h-4" />
            {searching ? '…' : 'Bul'}
          </button>
        </label>
      </div>

      {hits.length > 0 ? (
        <ul className="geo-lock-admin__results">
          {hits.map((h) => (
            <li key={`${h.lat}-${h.lng}-${h.label}`}>
              <button type="button" onClick={() => applyHit(h)}>
                {h.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <div className="geo-lock-admin__map-wrap">
        <div ref={mapRef} className="geo-lock-admin__map" />
        <div className="geo-lock-admin__map-actions">
          <button type="button" className="geo-lock-admin__map-btn" onClick={goHome}>
            <House className="w-3.5 h-3.5" />
            Eve git
          </button>
          <button
            type="button"
            className="geo-lock-admin__map-btn is-save"
            disabled={savingHome}
            onClick={() => void saveHome()}
          >
            {homeSaved ? <Check className="w-3.5 h-3.5" /> : <House className="w-3.5 h-3.5" />}
            {savingHome ? 'Kaydediliyor…' : homeSaved ? 'Ev kaydedildi' : 'Evi kaydet'}
          </button>
        </div>
      </div>

      <div className="geo-lock-admin__meta">
        <label>
          İzin verilen alan: {value.radiusMeters} m
          <input
            type="range"
            min={30}
            max={2000}
            step={10}
            value={value.radiusMeters}
            onChange={(e) =>
              onChange({ ...value, radiusMeters: Number(e.target.value) })
            }
          />
        </label>
        <p className="geo-lock-admin__coords">
          Ev simgesini sürükleyin, sonra Evi kaydet · {value.lat.toFixed(5)},{' '}
          {value.lng.toFixed(5)}
        </p>
      </div>
    </div>
  );
}

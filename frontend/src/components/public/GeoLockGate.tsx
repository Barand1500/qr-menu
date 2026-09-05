import { useCallback, useEffect, useState } from 'react';
import { MapPin, MapPinned, RefreshCw, ShieldOff } from 'lucide-react';
import {
  clearGeoCache,
  fetchGeoLockStatus,
  getBrowserPosition,
  readGeoCache,
  verifyGeoLock,
  writeGeoCache,
  type GeoCoords,
  type GeoGateStatus,
} from '@/lib/geoLock';
import '@/geo-lock.css';

type Props = {
  slug: string | null;
  /** true olunca children render */
  children: (ctx: { coords: GeoCoords | null }) => React.ReactNode;
};

export default function GeoLockGate({ slug, children }: Props) {
  const [status, setStatus] = useState<GeoGateStatus>('loading');
  const [message, setMessage] = useState('');
  const [coords, setCoords] = useState<GeoCoords | null>(null);
  const [busy, setBusy] = useState(false);

  const runCheck = useCallback(async (force = false) => {
    if (!slug) return;
    setBusy(true);
    setStatus('loading');
    setMessage('');
    try {
      const lock = await fetchGeoLockStatus(slug);
      if (!lock.enabled) {
        setCoords(null);
        setStatus('allowed');
        return;
      }

      if (!force) {
        const cached = readGeoCache(slug);
        if (cached) {
          const verified = await verifyGeoLock(slug, cached);
          if (verified.allowed) {
            setCoords(cached);
            setStatus('allowed');
            return;
          }
          clearGeoCache();
        }
      }

      let position: GeoCoords;
      try {
        position = await getBrowserPosition();
      } catch (e) {
        const code = e instanceof Error ? e.message : 'GEO_ERROR';
        if (code === 'GEO_DENIED') {
          setStatus('need_permission');
          setMessage('Menüyü görmek için konum izni vermelisiniz.');
        } else if (code === 'GEO_UNAVAILABLE') {
          setStatus('unavailable');
          setMessage('Bu cihazda konum servisi yok.');
        } else {
          setStatus('error');
          setMessage('Konum alınamadı. Konumu açıp tekrar deneyin.');
        }
        return;
      }

      const result = await verifyGeoLock(slug, position);
      if (result.allowed) {
        writeGeoCache(slug, position);
        setCoords(position);
        setStatus('allowed');
      } else {
        clearGeoCache();
        setCoords(null);
        setStatus('blocked');
        setMessage(result.message || 'Bölge dışındasınız');
      }
    } catch {
      setStatus('error');
      setMessage('Konum kontrolü yapılamadı. Bağlantıyı kontrol edin.');
    } finally {
      setBusy(false);
    }
  }, [slug]);

  useEffect(() => {
    void runCheck(false);
  }, [runCheck]);

  if (status === 'allowed') {
    return <>{children({ coords })}</>;
  }

  return (
    <div className="geo-lock-screen" role="alert">
      <div className="geo-lock-screen__card">
        <div className="geo-lock-screen__icon" aria-hidden>
          {status === 'blocked' ? (
            <MapPinned className="w-8 h-8" />
          ) : status === 'need_permission' ? (
            <MapPin className="w-8 h-8" />
          ) : (
            <ShieldOff className="w-8 h-8" />
          )}
        </div>
        <p className="geo-lock-screen__eyebrow">Konum kilidi</p>
        <h1>
          {status === 'loading'
            ? 'Konum kontrol ediliyor…'
            : status === 'blocked'
              ? 'Bölge dışındasınız'
              : status === 'need_permission'
                ? 'Konum izni gerekli'
                : 'Menüye erişilemiyor'}
        </h1>
        <p className="geo-lock-screen__text">
          {status === 'loading'
            ? 'Restoranın belirlediği alan içinde olduğunuz doğrulanıyor.'
            : message || 'Bu menü yalnızca restoran bölgesinde açılır.'}
        </p>
        {status !== 'loading' ? (
          <button
            type="button"
            className="geo-lock-screen__btn"
            disabled={busy}
            onClick={() => void runCheck(true)}
          >
            <RefreshCw className="w-4 h-4" />
            {busy ? 'Kontrol ediliyor…' : 'Tekrar dene'}
          </button>
        ) : null}
      </div>
    </div>
  );
}

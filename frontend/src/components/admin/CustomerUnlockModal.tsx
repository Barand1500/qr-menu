import { useEffect, useRef, useState } from 'react';
import { Camera, Hash, Loader2, X } from 'lucide-react';
import { lookupCustomerByCodeOrQr } from '@/lib/customerUnlock';

type Mode = 'menu' | 'code' | 'scan';

type Props = {
  open: boolean;
  onClose: () => void;
  onUnlocked: (customerId: number) => void;
  /** Başlangıçta doğrudan kod veya tarama */
  initialMode?: Mode;
  title?: string;
};

type BarcodeDetectorLike = {
  detect: (source: ImageBitmapSource) => Promise<Array<{ rawValue?: string }>>;
};

function getBarcodeDetector():
  | (new (opts?: { formats?: string[] }) => BarcodeDetectorLike)
  | null {
  const w = window as Window & {
    BarcodeDetector?: new (opts?: { formats?: string[] }) => BarcodeDetectorLike;
  };
  return w.BarcodeDetector || null;
}

export default function CustomerUnlockModal({
  open,
  onClose,
  onUnlocked,
  initialMode = 'menu',
  title = 'Müşteri kodu',
}: Props) {
  const [mode, setMode] = useState<Mode>(initialMode);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanHint, setScanHint] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const handledRef = useRef(false);

  useEffect(() => {
    if (!open) return;
    setMode(initialMode);
    setCode('');
    setError('');
    setScanHint('');
    setBusy(false);
    handledRef.current = false;
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || mode !== 'scan') {
      stopScan();
      return;
    }

    let cancelled = false;
    handledRef.current = false;

    async function start() {
      const Detector = getBarcodeDetector();
      if (!Detector) {
        setScanHint('Bu cihazda kamera QR okuyucu yok. Kodu elle yaz.');
        setMode('code');
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = stream;
        await video.play();
        const detector = new Detector({ formats: ['qr_code'] });

        const tick = async () => {
          if (cancelled || handledRef.current) return;
          try {
            if (video.readyState >= 2) {
              const codes = await detector.detect(video);
              const raw = codes[0]?.rawValue?.trim();
              if (raw) {
                handledRef.current = true;
                await submit({ qr: raw });
                return;
              }
            }
          } catch {
            /* frame skip */
          }
          rafRef.current = window.setTimeout(() => void tick(), 280) as unknown as number;
        };
        void tick();
      } catch {
        setError('Kameraya erişilemedi. Kod yazmayı dene.');
        setMode('code');
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode]);

  function stopScan() {
    if (rafRef.current) {
      window.clearTimeout(rafRef.current);
      rafRef.current = 0;
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }

  async function submit(body: { code?: string; qr?: string }) {
    setBusy(true);
    setError('');
    try {
      const res = await lookupCustomerByCodeOrQr(body);
      stopScan();
      onUnlocked(res.customerId);
      onClose();
    } catch (err) {
      handledRef.current = false;
      setError(err instanceof Error ? err.message : 'Doğrulama başarısız');
    } finally {
      setBusy(false);
    }
  }

  if (!open) return null;

  return (
    <div className="mc-unlock" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mc-unlock__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="mc-unlock__panel">
        <header className="mc-unlock__head">
          <div>
            <p className="mc-unlock__eyebrow">Müşteri kartı</p>
            <h3>{title}</h3>
          </div>
          <button type="button" className="mc-unlock__close" onClick={onClose} aria-label="Kapat">
            <X className="w-5 h-5" />
          </button>
        </header>

        {error ? <div className="mc-unlock__error">{error}</div> : null}

        {mode === 'menu' ? (
          <div className="mc-unlock__actions">
            <button type="button" className="mc-unlock__big" onClick={() => setMode('scan')}>
              <Camera className="w-5 h-5" />
              <span>
                <strong>QR okut</strong>
                <small>Müşterinin kişisel kodunu tara</small>
              </span>
            </button>
            <button type="button" className="mc-unlock__big is-soft" onClick={() => setMode('code')}>
              <Hash className="w-5 h-5" />
              <span>
                <strong>Kod yaz</strong>
                <small>6 haneli kodu gir</small>
              </span>
            </button>
          </div>
        ) : null}

        {mode === 'code' ? (
          <form
            className="mc-unlock__form"
            onSubmit={(e) => {
              e.preventDefault();
              const digits = code.replace(/\D/g, '');
              if (digits.length !== 6) {
                setError('6 haneli kod gir');
                return;
              }
              void submit({ code: digits });
            }}
          >
            <label htmlFor="mc-unlock-code">6 haneli kod</label>
            <input
              id="mc-unlock-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              autoFocus
              maxLength={7}
              placeholder="000 000"
              value={code}
              onChange={(e) => {
                const d = e.target.value.replace(/\D/g, '').slice(0, 6);
                setCode(d.length > 3 ? `${d.slice(0, 3)} ${d.slice(3)}` : d);
              }}
            />
            <button type="submit" className="mc-unlock__submit" disabled={busy}>
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? 'Kontrol…' : 'Müşteriyi aç'}
            </button>
            <button type="button" className="mc-unlock__link" onClick={() => setMode('scan')}>
              QR okutmayı dene
            </button>
          </form>
        ) : null}

        {mode === 'scan' ? (
          <div className="mc-unlock__scan">
            <div className="mc-unlock__video-wrap">
              <video ref={videoRef} playsInline muted />
              <span className="mc-unlock__frame" aria-hidden />
            </div>
            <p>{scanHint || 'QR’ı çerçeveye hizala'}</p>
            {busy ? (
              <p className="mc-unlock__busy">
                <Loader2 className="w-4 h-4 animate-spin" /> Doğrulanıyor…
              </p>
            ) : null}
            <button type="button" className="mc-unlock__link" onClick={() => setMode('code')}>
              Kod yaz
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

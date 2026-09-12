import { useEffect, useRef, useState } from 'react';
import { Camera, KeyRound, Loader2, X } from 'lucide-react';
import { lookupCustomerByCodeOrQr } from '@/lib/customerUnlock';

type Mode = 'menu' | 'code' | 'scan';

type Props = {
  open: boolean;
  onClose: () => void;
  onUnlocked: (customerId: number) => void;
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
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scanHint, setScanHint] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const handledRef = useRef(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);

  const codeValue = digits.join('');

  useEffect(() => {
    if (!open) return;
    setMode(initialMode === 'menu' ? 'menu' : initialMode);
    setDigits(['', '', '', '', '', '']);
    setError('');
    setScanHint('');
    setBusy(false);
    handledRef.current = false;
  }, [open, initialMode]);

  useEffect(() => {
    if (!open || mode !== 'code') return;
    const t = window.setTimeout(() => inputsRef.current[0]?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [open, mode]);

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

  function setDigitAt(index: number, raw: string) {
    const char = raw.replace(/\D/g, '').slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[index] = char;
      return next;
    });
    if (char && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function onDigitKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus();
    }
    if (e.key === 'ArrowLeft' && index > 0) inputsRef.current[index - 1]?.focus();
    if (e.key === 'ArrowRight' && index < 5) inputsRef.current[index + 1]?.focus();
  }

  function onDigitPaste(e: React.ClipboardEvent) {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!pasted) return;
    const next = Array.from({ length: 6 }, (_, i) => pasted[i] || '');
    setDigits(next);
    const focusAt = Math.min(pasted.length, 5);
    inputsRef.current[focusAt]?.focus();
  }

  if (!open) return null;

  return (
    <div className="mc-unlock" role="dialog" aria-modal="true" aria-label={title}>
      <button type="button" className="mc-unlock__scrim" aria-label="Kapat" onClick={onClose} />
      <div className="mc-unlock__panel">
        <div className="mc-unlock__accent" aria-hidden />

        <header className="mc-unlock__head">
          <div className="mc-unlock__brand">
            <span className="mc-unlock__brand-icon" aria-hidden>
              <KeyRound className="w-4 h-4" />
            </span>
            <div>
              <p className="mc-unlock__eyebrow">Müşteri kartı</p>
              <h3>{title}</h3>
            </div>
          </div>
          <button type="button" className="mc-unlock__close" onClick={onClose} aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </header>

        {mode !== 'menu' ? (
          <div className="mc-unlock__tabs" role="tablist">
            <button
              type="button"
              role="tab"
              className={mode === 'scan' ? 'is-active' : ''}
              aria-selected={mode === 'scan'}
              onClick={() => {
                setError('');
                setMode('scan');
              }}
            >
              <Camera className="w-3.5 h-3.5" />
              QR okut
            </button>
            <button
              type="button"
              role="tab"
              className={mode === 'code' ? 'is-active' : ''}
              aria-selected={mode === 'code'}
              onClick={() => {
                setError('');
                setMode('code');
              }}
            >
              <KeyRound className="w-3.5 h-3.5" />
              Kod yaz
            </button>
          </div>
        ) : null}

        {error ? <div className="mc-unlock__error">{error}</div> : null}

        {mode === 'menu' ? (
          <div className="mc-unlock__actions">
            <p className="mc-unlock__lead">
              Müşterinin telefonundaki kişisel kodu okut veya 6 haneyi yaz.
            </p>
            <button type="button" className="mc-unlock__choice" onClick={() => setMode('scan')}>
              <span className="mc-unlock__choice-icon">
                <Camera className="w-5 h-5" />
              </span>
              <span className="mc-unlock__choice-copy">
                <strong>QR okut</strong>
                <small>Kamerayı aç, kodu tara</small>
              </span>
            </button>
            <button
              type="button"
              className="mc-unlock__choice is-alt"
              onClick={() => setMode('code')}
            >
              <span className="mc-unlock__choice-icon">
                <KeyRound className="w-5 h-5" />
              </span>
              <span className="mc-unlock__choice-copy">
                <strong>Kod yaz</strong>
                <small>6 haneli kodu elle gir</small>
              </span>
            </button>
          </div>
        ) : null}

        {mode === 'code' ? (
          <form
            className="mc-unlock__form"
            onSubmit={(e) => {
              e.preventDefault();
              if (codeValue.length !== 6) {
                setError('6 haneli kodu eksiksiz gir');
                return;
              }
              void submit({ code: codeValue });
            }}
          >
            <p className="mc-unlock__hint">Profildeki 6 haneli kodu gir</p>
            <div className="mc-unlock__otp" onPaste={onDigitPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    inputsRef.current[i] = el;
                  }}
                  className={`mc-unlock__otp-cell${d ? ' is-filled' : ''}`}
                  inputMode="numeric"
                  autoComplete={i === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={d}
                  aria-label={`Hane ${i + 1}`}
                  onChange={(e) => setDigitAt(i, e.target.value)}
                  onKeyDown={(e) => onDigitKeyDown(i, e)}
                  onFocus={(e) => e.target.select()}
                />
              ))}
            </div>
            <button
              type="submit"
              className="mc-unlock__submit"
              disabled={busy || codeValue.length !== 6}
            >
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              {busy ? 'Kontrol ediliyor…' : 'Müşteriyi aç'}
            </button>
          </form>
        ) : null}

        {mode === 'scan' ? (
          <div className="mc-unlock__scan">
            <div className="mc-unlock__video-wrap">
              <video ref={videoRef} playsInline muted />
              <span className="mc-unlock__frame" aria-hidden />
            </div>
            <p className="mc-unlock__hint">{scanHint || 'QR’ı karenin içine hizala'}</p>
            {busy ? (
              <p className="mc-unlock__busy">
                <Loader2 className="w-4 h-4 animate-spin" /> Doğrulanıyor…
              </p>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

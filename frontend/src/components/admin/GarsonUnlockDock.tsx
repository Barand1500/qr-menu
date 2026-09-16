import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Camera, KeyRound, Loader2, X } from 'lucide-react';
import jsQR from 'jsqr';
import { lookupCustomerByCodeOrQr } from '@/lib/customerUnlock';

type Mode = 'scan' | 'code';

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

export default function GarsonUnlockDock({
  mode,
  onClose,
  onUnlocked,
}: {
  mode: Mode;
  onClose: () => void;
  onUnlocked: (customerId: number) => void;
}) {
  const [digits, setDigits] = useState(['', '', '', '', '', '']);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [hint, setHint] = useState('QR’ı karenin içine getir — otomatik okunur');
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number>(0);
  const handledRef = useRef(false);
  const inputsRef = useRef<Array<HTMLInputElement | null>>([]);
  const codeValue = digits.join('');

  useEffect(() => {
    setDigits(['', '', '', '', '', '']);
    setError('');
    setBusy(false);
    handledRef.current = false;
    setHint(
      mode === 'scan'
        ? 'QR’ı karenin içine getir — otomatik okunur'
        : 'Profildeki 6 haneli kodu gir'
    );
  }, [mode]);

  useEffect(() => {
    if (mode !== 'code') return;
    const t = window.setTimeout(() => inputsRef.current[0]?.focus(), 60);
    return () => window.clearTimeout(t);
  }, [mode]);

  useEffect(() => {
    if (mode !== 'scan') {
      stopScan();
      return;
    }

    let cancelled = false;
    handledRef.current = false;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
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

        const Detector = getBarcodeDetector();
        const detector = Detector ? new Detector({ formats: ['qr_code'] }) : null;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d', { willReadFrequently: true });

        const tick = async () => {
          if (cancelled || handledRef.current) return;
          try {
            if (video.readyState >= 2) {
              let raw = '';
              if (detector) {
                const codes = await detector.detect(video);
                raw = codes[0]?.rawValue?.trim() || '';
              }
              if (!raw && canvas && ctx) {
                const w = video.videoWidth;
                const h = video.videoHeight;
                if (w && h) {
                  canvas.width = w;
                  canvas.height = h;
                  ctx.drawImage(video, 0, 0, w, h);
                  const image = ctx.getImageData(0, 0, w, h);
                  const code = jsQR(image.data, w, h, { inversionAttempts: 'dontInvert' });
                  raw = code?.data?.trim() || '';
                }
              }
              if (raw) {
                handledRef.current = true;
                setHint('Kod okundu, doğrulanıyor…');
                await submit({ qr: raw });
                return;
              }
            }
          } catch {
            /* frame skip */
          }
          rafRef.current = window.setTimeout(() => void tick(), 220) as unknown as number;
        };
        void tick();
      } catch {
        setError('Kameraya erişilemedi. Kod yazmayı dene.');
        setHint('Kamera izni gerekli');
      }
    }

    void start();
    return () => {
      cancelled = true;
      stopScan();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

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
      if (mode === 'scan') setHint('Tekrar dene — QR’ı karenin içine getir');
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
    inputsRef.current[Math.min(pasted.length, 5)]?.focus();
  }

  if (mode === 'scan') {
    return (
      <div className="garson-unlock garson-unlock--scan" role="region" aria-label="QR okut">
        <div className="garson-unlock__scan-stage">
          <video ref={videoRef} playsInline muted autoPlay />
          <canvas ref={canvasRef} className="garson-unlock__canvas" aria-hidden />
          <div className="garson-unlock__scan-ui">
            <button
              type="button"
              className="garson-unlock__back"
              onClick={onClose}
              aria-label="Geri"
            >
              <ArrowLeft className="w-4 h-4" />
              Geri
            </button>
            <div className="garson-unlock__scan-frame" aria-hidden />
            <div className="garson-unlock__scan-foot">
              <span className="garson-unlock__scan-badge">
                <Camera className="w-3.5 h-3.5" />
                Otomatik okuma
              </span>
              <p>{hint}</p>
              {error ? <strong className="garson-unlock__err">{error}</strong> : null}
              {busy ? (
                <span className="garson-unlock__busy">
                  <Loader2 className="w-4 h-4 animate-spin" /> Doğrulanıyor…
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="garson-unlock garson-unlock--code" role="region" aria-label="Kod yaz">
      <div className="garson-unlock__code-card">
        <header className="garson-unlock__code-head">
          <div>
            <p className="garson-unlock__eyebrow">Müşteri kartı</p>
            <h3>
              <KeyRound className="w-4 h-4" />
              Kod yaz
            </h3>
          </div>
          <button type="button" className="garson-unlock__x" onClick={onClose} aria-label="Kapat">
            <X className="w-4 h-4" />
          </button>
        </header>
        <p className="garson-unlock__lead">Müşterinin telefonundaki 6 haneli kişisel kodu gir.</p>
        {error ? <div className="garson-unlock__error">{error}</div> : null}
        <form
          className="garson-unlock__form"
          onSubmit={(e) => {
            e.preventDefault();
            if (codeValue.length !== 6) {
              setError('6 haneli kodu eksiksiz gir');
              return;
            }
            void submit({ code: codeValue });
          }}
        >
          <div className="garson-unlock__otp" onPaste={onDigitPaste}>
            {digits.map((d, i) => (
              <input
                key={i}
                ref={(el) => {
                  inputsRef.current[i] = el;
                }}
                className={`garson-unlock__otp-cell${d ? ' is-filled' : ''}`}
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
            className="garson-unlock__submit"
            disabled={busy || codeValue.length !== 6}
          >
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
            {busy ? 'Kontrol ediliyor…' : 'Müşteriyi aç'}
          </button>
        </form>
      </div>
    </div>
  );
}

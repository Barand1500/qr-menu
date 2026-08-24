import { useEffect, useState, type FormEvent } from 'react';
import { X, Send, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import ComplaintMascot, {
  ComplaintMascotBubble,
  useComplaintBubbleLines,
} from '@/components/public/ComplaintMascot';

type ComplaintPhase = 'form' | 'sending' | 'done';

interface ComplaintBoxModalProps {
  open: boolean;
  slug: string;
  onClose: () => void;
}

async function postComplaint(slug: string, body: object) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await api<{ ok: boolean }>(`/api/menu/${slug}/complaints`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function ComplaintBoxModal({ open, slug, onClose }: ComplaintBoxModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [phase, setPhase] = useState<ComplaintPhase>('form');
  const [error, setError] = useState('');

  const mood = phase === 'done' ? 'happy' : phase === 'sending' ? 'sending' : 'sad';
  const lineIndex = useComplaintBubbleLines(mood, open);

  useEffect(() => {
    if (!open) return;
    setPhase('form');
    setError('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && phase !== 'sending') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKey);
    };
  }, [open, phase, onClose]);

  if (!open) return null;

  const canSend =
    fullName.trim().length >= 2 && message.trim().length >= 10 && phase === 'form';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError('');
    setPhase('sending');
    try {
      await postComplaint(slug, {
        fullName: fullName.trim(),
        phone: phone.trim() || undefined,
        message: message.trim(),
      });
      setPhase('done');
    } catch (err) {
      setPhase('form');
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Bağlantı zaman aşımına uğradı. Sunucu çalışıyor mu? Tekrar dene.');
      } else {
        setError(err instanceof Error ? err.message : 'Gönderilemedi, tekrar dener misin?');
      }
    }
  }

  function handleClose() {
    if (phase === 'sending') return;
    onClose();
    window.setTimeout(() => {
      setFullName('');
      setPhone('');
      setMessage('');
      setPhase('form');
      setError('');
    }, 300);
  }

  return (
    <div className="complaint-overlay" onClick={handleClose}>
      <div
        className={`complaint-modal login-glass ${phase === 'done' ? 'complaint-modal--done' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="complaint-title"
      >
        <button type="button" className="complaint-modal__close" onClick={handleClose} aria-label="Kapat">
          <X className="w-5 h-5" />
        </button>

        <div className="complaint-modal__hero">
          <ComplaintMascot mood={mood} />
          <ComplaintMascotBubble mood={mood} lineIndex={lineIndex} />
        </div>

        {phase !== 'done' ? (
          <form className="complaint-form" onSubmit={handleSubmit}>
            <h2 id="complaint-title" className="complaint-form__title">
              Şikayet Kutusu
            </h2>
            <p className="complaint-form__subtitle">
              Yaşadığın olumsuz deneyimi bizimle paylaş — sana geri dönüş yapalım.
            </p>

            <label className="complaint-field">
              <span>Ad Soyad *</span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Adınız Soyadınız"
                maxLength={150}
                disabled={phase === 'sending'}
              />
            </label>

            <label className="complaint-field">
              <span>
                Telefon <em>(opsiyonel)</em>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Sizi arayabilmemiz için"
                maxLength={30}
                disabled={phase === 'sending'}
              />
            </label>

            <label className="complaint-field">
              <span>Şikayetiniz *</span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ne oldu? Nasıl hissettin? Detaylı anlatırsan daha hızlı çözeriz…"
                rows={4}
                maxLength={2000}
                disabled={phase === 'sending'}
              />
            </label>

            {error && (
              <div className="complaint-form__error-box">
                <p>{error}</p>
                <button type="button" onClick={() => setError('')}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tamam
                </button>
              </div>
            )}

            <button type="submit" className="complaint-form__submit" disabled={!canSend}>
              <Send className="w-4 h-4" />
              {phase === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </form>
        ) : (
          <div className="complaint-done">
            <p>Mesajın güvenle bize ulaştı. Teşekkür ederiz!</p>
            <button type="button" className="complaint-form__submit" onClick={handleClose}>
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

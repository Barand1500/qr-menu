import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { X, Send, RefreshCw } from 'lucide-react';
import { api } from '@/lib/api';
import StarRating from '@/components/public/StarRating';
import SuggestionMascot, {
  SuggestionMascotBubble,
  ratingToMood,
  useSuggestionBubbleLines,
} from '@/components/public/SuggestionMascot';

type SuggestionPhase = 'form' | 'sending' | 'done';

interface SuggestionBoxModalProps {
  open: boolean;
  slug: string;
  onClose: () => void;
}

async function postSuggestion(slug: string, body: object) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await api<{ ok: boolean }>(`/api/menu/${slug}/suggestions`, {
      method: 'POST',
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    window.clearTimeout(timer);
  }
}

export default function SuggestionBoxModal({ open, slug, onClose }: SuggestionBoxModalProps) {
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [phase, setPhase] = useState<SuggestionPhase>('form');
  const [error, setError] = useState('');

  const mood = ratingToMood(rating, phase);
  const lineIndex = useSuggestionBubbleLines(mood, open);

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

  const canSend = rating >= 1 && phase === 'form';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError('');
    setPhase('sending');
    try {
      await postSuggestion(slug, {
        rating,
        fullName: fullName.trim() || undefined,
        phone: phone.trim() || undefined,
        message: message.trim() || undefined,
      });
      setPhase('done');
    } catch (err) {
      setPhase('form');
      if (err instanceof Error && err.name === 'AbortError') {
        setError('Bağlantı zaman aşımına uğradı. Tekrar dene.');
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
      setRating(0);
      setPhase('form');
      setError('');
    }, 300);
  }

  return (
    <div className="suggestion-overlay" onClick={handleClose}>
      <div className="suggestion-overlay__stars" aria-hidden>
        {Array.from({ length: 18 }).map((_, i) => (
          <span
            key={i}
            className="suggestion-overlay__star"
            style={{ animationDelay: `${i * 0.4}s`, left: `${(i * 17) % 100}%`, top: `${(i * 23) % 100}%` } as CSSProperties}
          />
        ))}
      </div>

      <div
        className={`suggestion-modal login-glass ${phase === 'done' ? 'suggestion-modal--done' : ''}`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-title"
      >
        <button type="button" className="suggestion-modal__close" onClick={handleClose} aria-label="Kapat">
          <X className="w-5 h-5" />
        </button>

        <div className="suggestion-modal__hero">
          <SuggestionMascot mood={mood} />
          <SuggestionMascotBubble mood={mood} lineIndex={lineIndex} />
        </div>

        {phase !== 'done' ? (
          <form className="suggestion-form" onSubmit={handleSubmit}>
            <h2 id="suggestion-title" className="suggestion-form__title">
              Öneri Kutusu
            </h2>
            <p className="suggestion-form__subtitle">
              Memnuniyet anketin — puanını ver, istersen önerini de yaz.
            </p>

            <StarRating
              value={rating}
              onChange={setRating}
              disabled={phase === 'sending'}
            />

            <label className="suggestion-field">
              <span>
                Ad Soyad <em>(opsiyonel)</em>
              </span>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="İsterseniz adınızı yazın"
                maxLength={150}
                disabled={phase === 'sending'}
              />
            </label>

            <label className="suggestion-field">
              <span>
                Telefon <em>(opsiyonel)</em>
              </span>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Geri dönüş için"
                maxLength={30}
                disabled={phase === 'sending'}
              />
            </label>

            <label className="suggestion-field">
              <span>
                Öneriniz <em>(opsiyonel)</em>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ne eklemek isterdin? Neyi sevdin?"
                rows={3}
                maxLength={2000}
                disabled={phase === 'sending'}
              />
            </label>

            {error && (
              <div className="suggestion-form__error-box">
                <p>{error}</p>
                <button type="button" onClick={() => setError('')}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tamam
                </button>
              </div>
            )}

            <button type="submit" className="suggestion-form__submit" disabled={!canSend}>
              <Send className="w-4 h-4" />
              {phase === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
            </button>
          </form>
        ) : (
          <div className="suggestion-done">
            <StarRating value={rating} onChange={() => {}} disabled />
            <p>Teşekkürler! Geri bildirimin bizim için çok değerli.</p>
            <button type="button" className="suggestion-form__submit" onClick={handleClose}>
              Kapat
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

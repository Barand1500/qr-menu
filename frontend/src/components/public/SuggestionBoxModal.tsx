import { useEffect, useState, type CSSProperties, type FormEvent } from 'react';
import { X, Send, RefreshCw, ChevronDown } from 'lucide-react';
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
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [phase, setPhase] = useState<SuggestionPhase>('form');
  const [error, setError] = useState('');
  const [contactOpen, setContactOpen] = useState(false);

  const mood = ratingToMood(rating, phase);
  const lineIndex = useSuggestionBubbleLines(mood, open);

  useEffect(() => {
    if (!open) return;
    setPhase('form');
    setError('');
    setContactOpen(false);
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
  const hasContact = Boolean(fullName.trim() || phone.trim() || email.trim());

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
        email: email.trim() || undefined,
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
      setEmail('');
      setMessage('');
      setRating(0);
      setPhase('form');
      setError('');
      setContactOpen(false);
    }, 300);
  }

  return (
    <div className="feedback-sheet-overlay suggestion-overlay" onClick={handleClose}>
      <div className="suggestion-overlay__stars" aria-hidden>
        {Array.from({ length: 10 }).map((_, i) => (
          <span
            key={i}
            className="suggestion-overlay__star"
            style={
              {
                animationDelay: `${i * 0.4}s`,
                left: `${(i * 17) % 100}%`,
                top: `${(i * 23) % 100}%`,
              } as CSSProperties
            }
          />
        ))}
      </div>

      <div
        className={`feedback-sheet suggestion-modal login-glass ${
          phase === 'done' ? 'suggestion-modal--done' : ''
        }`}
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="suggestion-title"
      >
        <div className="feedback-sheet__handle" aria-hidden />
        <button
          type="button"
          className="suggestion-modal__close"
          onClick={handleClose}
          aria-label="Kapat"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="feedback-sheet__hero suggestion-modal__hero">
          <SuggestionMascot mood={mood} />
          <SuggestionMascotBubble mood={mood} lineIndex={lineIndex} />
        </div>

        {phase !== 'done' ? (
          <form className="suggestion-form feedback-sheet__form" onSubmit={handleSubmit}>
            <div className="feedback-sheet__head">
              <h2 id="suggestion-title" className="suggestion-form__title">
                Öneri Kutusu
              </h2>
              <p className="suggestion-form__subtitle">Puanını ver, istersen kısa bir not bırak.</p>
            </div>

            <StarRating value={rating} onChange={setRating} disabled={phase === 'sending'} />

            <label className="suggestion-field">
              <span>
                Not <em>(opsiyonel)</em>
              </span>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Ne eklemek isterdin?"
                rows={2}
                maxLength={2000}
                disabled={phase === 'sending'}
              />
            </label>

            <button
              type="button"
              className={`feedback-sheet__more${contactOpen || hasContact ? ' is-open' : ''}`}
              onClick={() => setContactOpen((v) => !v)}
              disabled={phase === 'sending'}
            >
              <span>İletişim bilgisi ekle</span>
              <ChevronDown className="w-4 h-4" />
            </button>

            {contactOpen || hasContact ? (
              <div className="feedback-sheet__contact">
                <div className="feedback-sheet__row">
                  <label className="suggestion-field">
                    <span>Ad</span>
                    <input
                      type="text"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Adınız"
                      maxLength={150}
                      disabled={phase === 'sending'}
                    />
                  </label>
                  <label className="suggestion-field">
                    <span>Telefon</span>
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="05xx…"
                      maxLength={30}
                      disabled={phase === 'sending'}
                    />
                  </label>
                </div>
                <label className="suggestion-field">
                  <span>E-posta</span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ornek@mail.com"
                    maxLength={150}
                    disabled={phase === 'sending'}
                  />
                </label>
              </div>
            ) : null}

            {error ? (
              <div className="suggestion-form__error-box">
                <p>{error}</p>
                <button type="button" onClick={() => setError('')}>
                  <RefreshCw className="w-3.5 h-3.5" />
                  Tamam
                </button>
              </div>
            ) : null}

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

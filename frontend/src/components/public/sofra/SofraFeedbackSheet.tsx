import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Check, ChevronDown, Star } from 'lucide-react';
import { api } from '@/lib/api';
import SofraSheet from './SofraSheet';

export interface FeedbackProps {
  open: boolean;
  slug: string;
  onClose: () => void;
}
export default function SofraFeedbackSheet({
  open,
  slug,
  onClose,
  kind,
}: FeedbackProps & { kind: 'suggestion' | 'complaint' }) {
  const suggestion = kind === 'suggestion';
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [rating, setRating] = useState(0);
  const [contactOpen, setContactOpen] = useState(false);
  const [phase, setPhase] = useState<'form' | 'sending' | 'done'>('form');
  const [error, setError] = useState('');
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    if (open) {
      setFullName('');
      setPhone('');
      setEmail('');
      setMessage('');
      setRating(0);
      setContactOpen(false);
      setPhase('form');
      setError('');
    }
    return () => pending.current?.abort();
  }, [open]);
  const valid = suggestion
    ? rating > 0
    : fullName.trim().length >= 2 && message.trim().length >= 10;
  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!valid || phase !== 'form') return;
    const controller = new AbortController();
    pending.current = controller;
    const timer = window.setTimeout(() => controller.abort(), 15000);
    setPhase('sending');
    setError('');
    try {
      await api(`/api/menu/${slug}/${suggestion ? 'suggestions' : 'complaints'}`, {
        method: 'POST',
        signal: controller.signal,
        body: JSON.stringify({
          fullName: fullName.trim() || undefined,
          phone: phone.trim() || undefined,
          email: email.trim() || undefined,
          message: message.trim() || undefined,
          ...(suggestion ? { rating } : {}),
        }),
      });
      setPhase('done');
    } catch {
      setPhase('form');
      setError('Gönderilemedi. Lütfen tekrar deneyin; yazdıklarınız burada duruyor.');
    } finally {
      window.clearTimeout(timer);
      pending.current = null;
    }
  }
  return (
    <SofraSheet
      open={open}
      onClose={onClose}
      busy={phase === 'sending'}
      title={suggestion ? 'Öneri kutusu' : 'Şikâyet kutusu'}
      subtitle={
        suggestion
          ? 'Daha iyi bir sofra için fikriniz değerli.'
          : 'Sizi dinliyoruz. Yaşadığınız sorunu paylaşın.'
      }
    >
      {phase === 'done' ? (
        <div className="sofra-feedback-done" role="status">
          <Check size={30} />
          <h3>Teşekkür ederiz.</h3>
          <p>Mesajınız restoran ekibine iletildi.</p>
          <button className="sofra-sheet-primary" onClick={onClose}>
            Kapat
          </button>
        </div>
      ) : (
        <form className="sofra-feedback-form" onSubmit={submit}>
          <fieldset disabled={phase === 'sending'}>
            {suggestion && (
              <div className="sofra-rating">
                <p>Deneyiminiz nasıldı?</p>
                <div role="group" aria-label="Memnuniyet puanı">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      type="button"
                      key={star}
                      aria-label={`${star} yıldız`}
                      aria-pressed={rating === star}
                      onClick={() => setRating(star)}
                    >
                      <Star size={30} fill={star <= rating ? 'currentColor' : 'none'} />
                    </button>
                  ))}
                </div>
                <small>{rating ? `${rating} / 5` : 'Bir puan seçin'}</small>
              </div>
            )}
            {!suggestion && (
              <label>
                Adınız
                <input
                  required
                  minLength={2}
                  maxLength={150}
                  autoComplete="name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                />
              </label>
            )}
            <label>
              {suggestion ? 'Notunuz (isteğe bağlı)' : 'Ne yaşadınız?'}
              <textarea
                rows={3}
                required={!suggestion}
                minLength={suggestion ? undefined : 10}
                maxLength={2000}
                placeholder={
                  suggestion
                    ? 'Neyi daha iyi yapabiliriz?'
                    : 'Sorunu kısaca anlatın (en az 10 karakter)'
                }
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </label>
            <button
              type="button"
              className="sofra-contact-toggle"
              aria-expanded={contactOpen}
              onClick={() => setContactOpen(!contactOpen)}
            >
              İletişim bilgisi ekle{' '}
              <span>
                İsteğe bağlı <ChevronDown size={16} />
              </span>
            </button>
            {contactOpen && (
              <div className="sofra-contact-fields">
                {suggestion && (
                  <label>
                    Adınız
                    <input
                      minLength={2}
                      maxLength={150}
                      autoComplete="name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                    />
                  </label>
                )}
                <label>
                  Telefon
                  <input
                    type="tel"
                    maxLength={30}
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </label>
                <label>
                  E-posta
                  <input
                    type="email"
                    maxLength={150}
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </label>
              </div>
            )}
          </fieldset>
          {error && (
            <p className="sofra-sheet-error" role="alert">
              {error}
            </p>
          )}
          <button
            className="sofra-sheet-primary"
            type="submit"
            disabled={!valid || phase !== 'form'}
          >
            {phase === 'sending' ? 'Gönderiliyor…' : 'Gönder'}
          </button>
        </form>
      )}
    </SofraSheet>
  );
}

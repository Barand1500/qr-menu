import { useId, useState } from 'react';
import { Mail, MessageCircle, Send } from 'lucide-react';
import { normalizePhoneDigits } from '@/lib/socialCatalog';
import '@/feedback-reply.css';

type Channel = 'whatsapp' | 'email';

type FeedbackReplyPanelProps = {
  phone?: string | null;
  email?: string | null;
  guestName?: string | null;
  restaurantName?: string | null;
  kind: 'complaint' | 'suggestion';
  onSent?: () => void;
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(value?: string | null) {
  const v = String(value || '').trim();
  return v.length > 3 && EMAIL_RE.test(v);
}

function defaultReplyText(
  kind: 'complaint' | 'suggestion',
  guestName: string | null | undefined,
  restaurantName: string | null | undefined
) {
  const name = guestName?.trim();
  const greeting = name ? `Merhaba ${name}` : 'Merhaba';
  const place = restaurantName?.trim();
  const from = place ? ` — ${place}` : '';
  if (kind === 'complaint') {
    return `${greeting},${from}\n\nŞikayetiniz için teşekkür ederiz. Konuyu inceledik ve size yardımcı olmak istiyoruz.\n\n`;
  }
  return `${greeting},${from}\n\nGeri bildiriminiz için teşekkür ederiz. Notunuzu aldık.\n\n`;
}

function mailSubject(
  kind: 'complaint' | 'suggestion',
  restaurantName: string | null | undefined
) {
  const place = restaurantName?.trim();
  if (kind === 'complaint') {
    return place ? `${place} — Şikayet yanıtı` : 'Şikayet yanıtı';
  }
  return place ? `${place} — Öneri yanıtı` : 'Öneri yanıtı';
}

export function FeedbackReplyPanel({
  phone,
  email,
  guestName,
  restaurantName,
  kind,
  onSent,
}: FeedbackReplyPanelProps) {
  const fieldId = useId();
  const [channel, setChannel] = useState<Channel | null>(null);
  const [text, setText] = useState(() => defaultReplyText(kind, guestName, restaurantName));

  const digits = phone ? normalizePhoneDigits(phone) : '';
  const canWhatsApp = digits.length >= 10;
  const mail = String(email || '').trim();
  const canEmail = isValidEmail(mail);

  function openChannel(next: Channel) {
    if (next === 'whatsapp' && !canWhatsApp) return;
    if (next === 'email' && !canEmail) return;
    setText(defaultReplyText(kind, guestName, restaurantName));
    setChannel(next);
  }

  function send() {
    const body = text.trim();
    if (!body || !channel) return;

    if (channel === 'whatsapp') {
      if (!canWhatsApp) return;
      window.open(
        `https://wa.me/${digits}?text=${encodeURIComponent(body)}`,
        '_blank',
        'noopener,noreferrer'
      );
    } else {
      if (!canEmail) return;
      const subject = mailSubject(kind, restaurantName);
      window.location.href = `mailto:${encodeURIComponent(mail)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    }

    setChannel(null);
    onSent?.();
  }

  return (
    <div className="feedback-reply">
      <div className="feedback-reply__channels">
        <button
          type="button"
          className={`feedback-reply__channel is-wa${channel === 'whatsapp' ? ' is-open' : ''}${
            canWhatsApp ? '' : ' is-disabled'
          }`}
          disabled={!canWhatsApp}
          title={canWhatsApp ? 'WhatsApp ile yanıtla' : 'Telefon numarası yok'}
          onClick={() => openChannel('whatsapp')}
        >
          <MessageCircle className="w-4 h-4" />
          WhatsApp
        </button>
        <button
          type="button"
          className={`feedback-reply__channel is-mail${channel === 'email' ? ' is-open' : ''}${
            canEmail ? '' : ' is-disabled'
          }`}
          disabled={!canEmail}
          title={canEmail ? 'E-posta ile yanıtla' : 'E-posta adresi yok'}
          onClick={() => openChannel('email')}
        >
          <Mail className="w-4 h-4" />
          E-posta
        </button>
      </div>

      {!canWhatsApp && !canEmail ? (
        <p className="feedback-reply__hint">
          İletişim bilgisi yok — misafir telefon veya e-posta bırakmadı.
        </p>
      ) : null}

      {channel ? (
        <div className="feedback-reply__box">
          <label className="feedback-reply__label" htmlFor={fieldId}>
            {channel === 'whatsapp' ? 'WhatsApp yanıtı' : 'E-posta yanıtı'}
          </label>
          <textarea
            id={fieldId}
            className="feedback-reply__textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yanıtınızı yazın…"
          />
          <div className="feedback-reply__actions">
            <button type="button" className="feedback-reply__cancel" onClick={() => setChannel(null)}>
              Vazgeç
            </button>
            <button
              type="button"
              className="feedback-reply__send"
              disabled={!text.trim()}
              onClick={send}
            >
              <Send className="w-4 h-4" />
              Yanıt gönder
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

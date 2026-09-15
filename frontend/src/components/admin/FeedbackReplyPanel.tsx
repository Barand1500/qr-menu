import { useState } from 'react';
import { Reply, Send } from 'lucide-react';
import { normalizePhoneDigits } from '@/lib/socialCatalog';
import '@/feedback-reply.css';

type FeedbackReplyPanelProps = {
  phone?: string | null;
  guestName?: string | null;
  restaurantName?: string | null;
  kind: 'complaint' | 'suggestion';
  onSent?: () => void;
};

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

export function FeedbackReplyPanel({
  phone,
  guestName,
  restaurantName,
  kind,
  onSent,
}: FeedbackReplyPanelProps) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState(() => defaultReplyText(kind, guestName, restaurantName));
  const digits = phone ? normalizePhoneDigits(phone) : '';
  const canReply = digits.length >= 10;

  function send() {
    if (!canReply) return;
    const body = text.trim();
    if (!body) return;
    const url = `https://wa.me/${digits}?text=${encodeURIComponent(body)}`;
    window.open(url, '_blank', 'noopener,noreferrer');
    setOpen(false);
    onSent?.();
  }

  if (!canReply) {
    return (
      <p className="feedback-reply__hint">
        Yanıt için telefon numarası yok — misafir numara bırakmadı.
      </p>
    );
  }

  return (
    <div className="feedback-reply">
      {!open ? (
        <button
          type="button"
          className="feedback-reply__toggle"
          onClick={() => {
            setText(defaultReplyText(kind, guestName, restaurantName));
            setOpen(true);
          }}
        >
          <Reply className="w-4 h-4" />
          Yanıtla
        </button>
      ) : (
        <div className="feedback-reply__box">
          <label className="feedback-reply__label" htmlFor={`fb-reply-${kind}-${digits}`}>
            WhatsApp yanıtı
          </label>
          <textarea
            id={`fb-reply-${kind}-${digits}`}
            className="feedback-reply__textarea"
            rows={4}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Yanıtınızı yazın…"
          />
          <div className="feedback-reply__actions">
            <button type="button" className="feedback-reply__cancel" onClick={() => setOpen(false)}>
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
      )}
    </div>
  );
}

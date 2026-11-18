import {
  CheckCheck,
  Lightbulb,
  Mail,
  Phone,
  Quote,
  Star,
  Trash2,
} from 'lucide-react';
import { FeedbackReplyPanel } from '@/components/admin/FeedbackReplyPanel';
import type { Suggestion } from '@/pages/admin/SuggestionsPage';

export function suggestionDate(iso: string, compact = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
  return new Intl.DateTimeFormat(
    'tr-TR',
    compact
      ? { day: 'numeric', month: 'short' }
      : { dateStyle: 'long', timeStyle: 'short' },
  ).format(date);
}
export function SuggestionRating({ rating }: { rating: number }) {
  const safe = Number.isFinite(rating) ? Math.max(0, Math.min(5, rating)) : 0;
  return (
    <span
      className="asg-rating"
      aria-label={safe ? '5 üzerinden ' + safe + ' puan' : 'Puan belirtilmemiş'}
    >
      <span aria-hidden="true">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            size={14}
            fill={n <= safe ? 'currentColor' : 'none'}
            className={n <= safe ? 'is-filled' : ''}
          />
        ))}
      </span>
      <strong aria-hidden="true">{safe ? safe + '/5' : '—'}</strong>
    </span>
  );
}

export default function SuggestionReader({
  item,
  restaurantName,
  busy,
  confirmDelete,
  onRead,
  onDelete,
  onConfirmChange,
}: {
  item: Suggestion;
  restaurantName?: string;
  busy: boolean;
  confirmDelete: boolean;
  onRead: () => void;
  onDelete: () => void;
  onConfirmChange: (value: boolean) => void;
}) {
  const hasContact = Boolean(item.phone?.trim() || item.email?.trim());
  return (
    <div className="asg-reader__inner">
      <div className="asg-reader__scroll" key={item.id}>
        <header className="asg-letter-head">
          <span className="asg-letter-head__icon">
            <Lightbulb size={21} strokeWidth={1.5} />
          </span>
          <div>
            <small>MİSAFİRİNİZDEN BİR NOT</small>
            <h2>{item.fullName?.trim() || 'Bir misafiriniz'}</h2>
            <time dateTime={item.createdAt}>
              {suggestionDate(item.createdAt)}
            </time>
          </div>
          <span className={'asg-read-badge ' + (!item.isRead ? 'is-new' : '')}>
            {item.isRead ? 'Okundu' : 'Yeni'}
          </span>
        </header>
        <div className="asg-letter-rating">
          <SuggestionRating rating={item.rating} />
        </div>
        <div className="asg-note">
          <Quote size={30} strokeWidth={1.2} aria-hidden="true" />
          <p>
            {item.message?.trim() ||
              'Misafiriniz bir not eklemeden puan bırakmış.'}
          </p>
        </div>
        <div className="asg-contact">
          {item.phone && (
            <span>
              <Phone size={14} />
              <span>{item.phone}</span>
            </span>
          )}
          {item.email && (
            <span>
              <Mail size={14} />
              <span>{item.email}</span>
            </span>
          )}
        </div>
        {hasContact ? (
          <section className="asg-reply">
            <div>
              <h3>Küçük bir teşekkür, güzel bir başlangıç.</h3>
              <p>Yanıtınız seçtiğiniz uygulamada açılır.</p>
            </div>
            <fieldset disabled={busy}>
              <FeedbackReplyPanel
                key={item.id}
                kind="suggestion"
                phone={item.phone}
                email={item.email}
                guestName={item.fullName}
                restaurantName={restaurantName}
                onSent={() => {
                  if (!item.isRead) onRead();
                }}
              />
            </fieldset>
          </section>
        ) : (
          <p className="asg-no-contact">Misafir iletişim bilgisi bırakmamış.</p>
        )}
      </div>
      <footer className="asg-reader__actions">
        {confirmDelete ? (
          <div
            className="asg-confirm"
            role="group"
            aria-label="Öneriyi silme onayı"
          >
            <p>Bu not kalıcı olarak silinecek.</p>
            <div>
              <button disabled={busy} onClick={() => onConfirmChange(false)}>
                Vazgeç
              </button>
              <button className="is-danger" disabled={busy} onClick={onDelete}>
                <Trash2 size={15} />
                {busy ? 'Siliniyor…' : 'Öneriyi sil'}
              </button>
            </div>
          </div>
        ) : (
          <>
            <button
              className={'asg-mark ' + (item.isRead ? 'is-read' : '')}
              disabled={busy || item.isRead}
              onClick={onRead}
            >
              <CheckCheck size={17} />
              {item.isRead ? 'Okundu' : 'Okundu işaretle'}
            </button>
            <button
              className="asg-delete"
              aria-label="Öneriyi sil"
              disabled={busy}
              onClick={() => onConfirmChange(true)}
            >
              <Trash2 size={17} />
              <span>Sil</span>
            </button>
          </>
        )}
      </footer>
    </div>
  );
}

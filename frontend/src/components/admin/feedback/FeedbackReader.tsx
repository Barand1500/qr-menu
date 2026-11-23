import {
  CheckCheck,
  Lightbulb,
  Mail,
  MessageSquareText,
  Phone,
  Quote,
  Star,
  Trash2,
} from 'lucide-react';
import { FeedbackReplyPanel } from '@/components/admin/FeedbackReplyPanel';
import {
  FEEDBACK_COPY,
  type FeedbackItem,
  type FeedbackKind,
} from './feedback-model';

export function feedbackDate(iso: string, compact = false) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return 'Tarih bilinmiyor';
  return new Intl.DateTimeFormat(
    'tr-TR',
    compact
      ? { day: 'numeric', month: 'short' }
      : { dateStyle: 'long', timeStyle: 'short' },
  ).format(date);
}
export function FeedbackRating({ rating }: { rating?: number }) {
  const safe =
    typeof rating === 'number' && Number.isFinite(rating)
      ? Math.max(0, Math.min(5, rating))
      : 0;
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

export default function FeedbackReader({
  item,
  kind,
  restaurantName,
  busy,
  confirmDelete,
  onRead,
  onDelete,
  onConfirmChange,
}: {
  item: FeedbackItem;
  kind: FeedbackKind;
  restaurantName?: string;
  busy: boolean;
  confirmDelete: boolean;
  onRead: () => void;
  onDelete: () => void;
  onConfirmChange: (value: boolean) => void;
}) {
  const copy = FEEDBACK_COPY[kind];
  const NoteIcon = kind === 'manager' ? Mail : kind === 'complaint' ? MessageSquareText : Lightbulb;
  const hasContact = Boolean(item.phone?.trim() || item.email?.trim());
  return (
    <div className="asg-reader__inner">
      <div className="asg-reader__scroll" key={item.id}>
        <header className="asg-letter-head">
          <span className="asg-letter-head__icon">
            <NoteIcon size={21} strokeWidth={1.5} />
          </span>
          <div>
            <small>{copy.letterLabel}</small>
            <h2>{item.fullName?.trim() || 'Bir misafiriniz'}</h2>
            <time dateTime={item.createdAt}>
              {feedbackDate(item.createdAt)}
            </time>
          </div>
          <span className={'asg-read-badge ' + (!item.isRead ? 'is-new' : '')}>
            {item.isRead ? 'Okundu' : 'Yeni'}
          </span>
        </header>
        {kind === 'suggestion' && (
          <div className="asg-letter-rating">
            <FeedbackRating rating={item.rating} />
          </div>
        )}
        {kind === 'manager' && <span className="asg-read-badge">{item.kind === 'suggestion' ? 'Öneri' : 'Şikâyet'} · Yöneticiye özel</span>}
        <div className="asg-note">
          <Quote size={30} strokeWidth={1.2} aria-hidden="true" />
          <p>{item.message?.trim() || copy.noMessage}</p>
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
              <h3>{copy.replyTitle}</h3>
              <p>Yanıtınız seçtiğiniz uygulamada açılır.</p>
            </div>
            <fieldset disabled={busy}>
              <FeedbackReplyPanel
                key={item.id}
                kind={kind === 'manager' ? item.kind || 'complaint' : kind}
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
            aria-label={copy.deleteGroup}
          >
            <p>{copy.deleteConfirm}</p>
            <div>
              <button disabled={busy} onClick={() => onConfirmChange(false)}>
                Vazgeç
              </button>
              <button className="is-danger" disabled={busy} onClick={onDelete}>
                <Trash2 size={15} />
                {busy ? 'Siliniyor…' : copy.deleteLabel}
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
              aria-label={copy.deleteLabel}
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

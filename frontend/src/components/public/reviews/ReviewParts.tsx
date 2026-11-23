import { Star } from 'lucide-react';
import { formatRating, reviewsCopy, type PublicReviews, type ReviewItem } from '@/lib/reviews';

/** 1–5 yıldız; dolu olanlar vurgu renginde. */
export function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="rv-stars" role="img" aria-label={`${value} / 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} className={n <= Math.round(value) ? 'is-on' : ''} fill={n <= Math.round(value) ? 'currentColor' : 'none'} strokeWidth={1.8} aria-hidden="true" />
      ))}
    </span>
  );
}

const initialOf = (name: string) => name.trim().charAt(0).toLocaleUpperCase('tr') || '•';

/** Tek yorum kartı. Google'dan gelenlerde "Google" işareti, elle girilenlerde "Misafirlerimizden" yazar. */
export function ReviewCard({ item, lang, decorative = false }: { item: ReviewItem; lang: string; decorative?: boolean }) {
  const t = reviewsCopy(lang);
  return (
    <figure className="rv-card" aria-hidden={decorative || undefined}>
      <div className="rv-card__top">
        <span className="rv-avatar" aria-hidden="true">
          {item.photo ? <img src={item.photo} alt="" referrerPolicy="no-referrer" loading="lazy" data-no-fit /> : <b>{initialOf(item.name)}</b>}
        </span>
        <div>
          <figcaption>{item.name}</figcaption>
          <small>{item.source === 'google' ? `Google${item.when ? ` · ${item.when}` : ''}` : t.fromGuests}</small>
        </div>
      </div>
      <Stars value={item.rating} />
      <blockquote>{item.text}</blockquote>
    </figure>
  );
}

/** "★ 4,7 · 312 Google yorumu" */
export function RatingBadge({ reviews, lang }: { reviews: PublicReviews; lang: string }) {
  const t = reviewsCopy(lang);
  if (reviews.rating === null) return null;
  return (
    <span className="rv-badge">
      <Star size={15} fill="currentColor" aria-hidden="true" />
      <strong>{formatRating(reviews.rating, lang)}</strong>
      {reviews.count ? <span>· {reviews.count.toLocaleString(lang.startsWith('tr') ? 'tr-TR' : 'en-US')} {t.google}</span> : null}
    </span>
  );
}

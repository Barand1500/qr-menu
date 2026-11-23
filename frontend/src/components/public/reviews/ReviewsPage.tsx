import { ExternalLink, MapPin, PenLine } from 'lucide-react';
import { formatRating, reviewsCopy, type PublicReviews } from '@/lib/reviews';
import { ReviewCard, Stars } from './ReviewParts';
import './reviews.css';

/** "Daha fazla" ekranındaki yorumlar sayfası: puan özeti, yorum yaz bağlantısı ve tüm yorumlar. */
export default function ReviewsPage({ reviews, lang }: { reviews: PublicReviews; lang: string }) {
  const t = reviewsCopy(lang);
  const tr = lang.startsWith('tr');
  return (
    <div className="rv-page">
      {reviews.rating !== null ? (
        <header className="rv-page__head">
          <strong>{formatRating(reviews.rating, lang)}</strong>
          <div>
            <Stars value={reviews.rating} size={18} />
            <small>
              {reviews.count ? `${reviews.count.toLocaleString(tr ? 'tr-TR' : 'en-US')} ${t.google}` : t.google}
            </small>
          </div>
        </header>
      ) : null}
      {reviews.writeUrl || reviews.mapsUrl ? (
        <div className="rv-page__actions">
          {reviews.writeUrl ? (
            <a className="is-primary" href={reviews.writeUrl} target="_blank" rel="noopener noreferrer">
              <PenLine size={16} aria-hidden="true" /> {t.write} <ExternalLink size={13} aria-hidden="true" />
            </a>
          ) : null}
          {reviews.mapsUrl ? (
            <a href={reviews.mapsUrl} target="_blank" rel="noopener noreferrer">
              <MapPin size={16} aria-hidden="true" /> {t.map}
            </a>
          ) : null}
        </div>
      ) : null}
      {reviews.items.length ? (
        <div className="rv-page__grid">
          {reviews.items.map((item) => (
            <ReviewCard key={item.id} item={item} lang={lang} />
          ))}
        </div>
      ) : (
        <p className="rv-page__empty">{t.empty}</p>
      )}
    </div>
  );
}

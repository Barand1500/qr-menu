import { useEffect, useState } from 'react';
import type { PublicReviews } from '@/lib/reviews';
import { RatingBadge, Stars } from './ReviewParts';
import './reviews.css';

/** Telefon karşılamasında: puan rozeti + her birkaç saniyede değişen tek yorum. */
export default function ReviewsTicker({ reviews, lang }: { reviews: PublicReviews; lang: string }) {
  const [index, setIndex] = useState(0);
  const items = reviews.items;

  useEffect(() => {
    if (items.length < 2) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => setIndex((i) => (i + 1) % items.length), 5200);
    return () => window.clearInterval(id);
  }, [items.length]);

  const item = items[index % Math.max(1, items.length)];
  if (!item && reviews.rating === null) return null;
  return (
    <div className="rv-ticker">
      <RatingBadge reviews={reviews} lang={lang} />
      {item ? (
        <figure key={item.id} className="rv-ticker__quote" aria-live="off">
          <Stars value={item.rating} size={12} />
          <blockquote>“{item.text}”</blockquote>
          <figcaption>{item.name}</figcaption>
        </figure>
      ) : null}
    </div>
  );
}

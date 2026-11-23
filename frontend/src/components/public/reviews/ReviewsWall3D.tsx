import { useMemo, useState } from 'react';
import type { ReviewItem } from '@/lib/reviews';
import { ReviewCard } from './ReviewParts';
import './reviews.css';

const COLUMNS = 4;

/** Decorative desktop backdrop; readable reviews remain in the More screen. */
export default function ReviewsWall3D({ items, lang }: { items: ReviewItem[]; lang: string }) {
  // A new visit gets a new arrangement. Ordinary rerenders keep that arrangement.
  const [seed] = useState(() => Math.floor(Math.random() * 0x100000000));
  const columns = useMemo(() => {
    if (!items.length) return [];
    let state = seed;
    const random = () => {
      state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
      return state / 0x100000000;
    };
    return Array.from({ length: COLUMNS }, () => {
      const set: ReviewItem[] = [];
      // Each column uses the full pool, rather than repeating one person's review.
      // Eight cards cover the tilted viewport even with short/empty review text.
      while (set.length < Math.max(8, items.length)) {
        const bag = [...items];
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(random() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        if (bag.length > 1 && bag[0].id === set.at(-1)?.id) {
          [bag[0], bag[1]] = [bag[1], bag[0]];
        }
        set.push(...bag.slice(0, Math.max(8, items.length) - set.length));
      }
      // Avoid the same review touching itself at the seamless loop boundary.
      if (set.length > 2 && set[0].id === set.at(-1)?.id) {
        const swap = set.findIndex((item, i) => i > 0 && i < set.length - 2 &&
          item.id !== set[0].id && item.id !== set[set.length - 2].id &&
          set[i - 1].id !== set[0].id && set[i + 1].id !== set[0].id);
        if (swap >= 0) [set[swap], set[set.length - 1]] = [set[set.length - 1], set[swap]];
      }
      return set;
    });
  }, [items, seed]);
  if (!columns.length) return null;
  return (
    <div className="rv-wall" aria-hidden="true">
      <div className="rv-wall__stage">
        {columns.map((set, c) => (
          <div key={c} className={`rv-wall__col${c % 2 ? ' is-reverse' : ''}`}
            style={{ ['--d' as string]: `${46 + c * 6}s`, ['--delay' as string]: `${-(46 + c * 6) * (c + 0.5) / COLUMNS}s` }}>
            {/* Equal content groups include their trailing gap: exactly -50% is one full lap. */}
            {[0, 1].map((copy) => (
              <div className="rv-wall__group" key={copy}>
                {set.map((item, i) => <ReviewCard key={`${item.id}-${i}`} item={item} lang={lang} decorative />)}
              </div>
            ))}
          </div>
        ))}
      </div>
      <i className="rv-wall__fade rv-wall__fade--top" />
      <i className="rv-wall__fade rv-wall__fade--bottom" />
      <i className="rv-wall__fade rv-wall__fade--left" />
      <i className="rv-wall__fade rv-wall__fade--right" />
    </div>
  );
}

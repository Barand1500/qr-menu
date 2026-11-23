import { useMemo } from 'react';
import type { ReviewItem } from '@/lib/reviews';
import { ReviewCard } from './ReviewParts';
import './reviews.css';

const COLUMNS = 4;

/**
 * Geniş ekran karşılamasının arkasında, eğik 3B perspektifte süzülen yorum duvarı.
 * Dört sütun, ikisi yukarı ikisi aşağı akar. Süs olduğu için ekran okuyuculardan gizlidir;
 * yorumların tamamı "Daha fazla" ekranında okunabilir.
 */
export default function ReviewsWall3D({ items, lang }: { items: ReviewItem[]; lang: string }) {
  const columns = useMemo(() => {
    if (!items.length) return [];
    return Array.from({ length: COLUMNS }, (_, c) => {
      // Her sütun farklı yorumdan başlar; az yorumda tekrarlanarak en az 6 karta tamamlanır
      const own = items.filter((_, i) => i % COLUMNS === c);
      const base = own.length ? own : items;
      const set: ReviewItem[] = [];
      for (let i = 0; set.length < 6; i++) set.push(base[(i + c) % base.length]);
      return set;
    });
  }, [items]);
  if (!columns.length) return null;
  return (
    <div className="rv-wall" aria-hidden="true">
      <div className="rv-wall__stage">
        {columns.map((set, c) => (
          <div key={c} className={`rv-wall__col${c % 2 ? ' is-reverse' : ''}`} style={{ ['--d' as string]: `${46 + c * 6}s` }}>
            {/* Aynı küme iki kez: -%50 kaydırınca döngü kesintisiz olur */}
            {[...set, ...set].map((item, i) => (
              <ReviewCard key={`${item.id}-${i}`} item={item} lang={lang} decorative />
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

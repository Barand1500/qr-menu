import { Star } from 'lucide-react';
import type { CSSProperties } from 'react';
import { STAR_COLORS } from '@/components/public/SuggestionMascot';

const LABELS = ['', 'Geliştirelim', 'İdare eder', 'Güzel', 'Harika', 'Muhteşem!'];

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export default function StarRating({ value, onChange, disabled }: StarRatingProps) {
  return (
    <div className="star-rating">
      <p className="star-rating__label">
        {value === 0 ? 'Deneyiminizi puanlayın' : LABELS[value]}
      </p>
      <div className="star-rating__row" role="radiogroup" aria-label="Memnuniyet puanı">
        {[1, 2, 3, 4, 5].map((star) => {
          const active = star <= value;
          const color = STAR_COLORS[star - 1];
          return (
            <button
              key={star}
              type="button"
              role="radio"
              aria-checked={value === star}
              aria-label={`${star} yıldız`}
              disabled={disabled}
              className={`star-rating__star ${active ? 'is-active' : ''}`}
              style={{ '--star-color': color } as CSSProperties}
              onClick={() => onChange(star)}
            >
              <Star
                className="star-rating__icon"
                fill={active ? color : 'transparent'}
                stroke={active ? color : 'rgba(255,255,255,0.45)'}
                strokeWidth={1.75}
              />
              <span className="star-rating__burst" aria-hidden />
            </button>
          );
        })}
      </div>
    </div>
  );
}

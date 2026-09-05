import { Flame } from 'lucide-react';

/** Sporcu tarzı kalori rozeti — yüksek kcal’de alev */
export function siparisKcalTier(calories: number): 'light' | 'mid' | 'high' | 'max' {
  if (calories >= 700) return 'max';
  if (calories >= 500) return 'high';
  if (calories >= 300) return 'mid';
  return 'light';
}

export default function SiparisKcal({
  calories,
  className = '',
}: {
  calories: number;
  className?: string;
}) {
  if (!(calories > 0)) return null;
  const tier = siparisKcalTier(calories);
  const flames = tier === 'max' ? 2 : tier === 'high' ? 1 : 0;

  return (
    <span className={`siparis-kcal siparis-kcal--${tier} ${className}`.trim()}>
      {flames > 0
        ? Array.from({ length: flames }, (_, i) => (
            <Flame key={i} className="siparis-kcal__flame" aria-hidden />
          ))
        : null}
      <span className="siparis-kcal__value">{calories}</span>
      <span className="siparis-kcal__unit">kcal</span>
    </span>
  );
}

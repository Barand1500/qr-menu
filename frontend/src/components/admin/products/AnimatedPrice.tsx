import { useEffect, useState } from 'react';
import { formatMoney } from '@/lib/api';
import type { Product } from './types';

export type PriceTransition = {
  from: number;
  to: number;
  delay: number;
  token: number;
};

/** The server value is final already; this only reveals the successful change. */
export default function AnimatedPrice({
  value,
  currency,
  transition,
}: {
  value: number;
  currency: Product['currency'];
  transition?: PriceTransition;
}) {
  const [display, setDisplay] = useState(value),
    [phase, setPhase] = useState('');
  useEffect(() => {
    if (
      !transition ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setDisplay(value);
      setPhase('');
      return;
    }
    const start = performance.now() + transition.delay;
    let frame = 0;
    setDisplay(transition.from);
    setPhase('is-waiting');
    function tick(now: number) {
      const t = Math.min(1, Math.max(0, (now - start) / 550));
      if (now >= start) {
        setPhase(t < 1 ? 'is-revealing' : '');
        setDisplay(
          transition!.from +
            (transition!.to - transition!.from) * (1 - Math.pow(1 - t, 3)),
        );
      }
      if (t < 1) frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, transition]);
  return (
    <span className={`ap-price-change ${phase}`}>
      <span aria-hidden={Boolean(transition)}>
        {formatMoney(transition ? display : value, currency)}
      </span>
      {transition && (
        <span className="sr-only">{formatMoney(value, currency)}</span>
      )}
    </span>
  );
}

import { useEffect, useRef, useState } from 'react';
import { gsap, prefersReducedMotion } from '@/lib/gsapSetup';

/** Fiyat değişince rakamlar sayaç gibi akar. React metni yalnızca ilk kez yazar; sonrasını tween günceller. */
export default function RollingPrice({ value, format }: { value: number; format: (n: number) => string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(value);
  const [initial] = useState(() => format(value));
  const fmt = useRef(format);
  fmt.current = format;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (prefersReducedMotion()) {
      shown.current = value;
      el.textContent = fmt.current(value);
      return;
    }
    const o = { v: shown.current };
    const tween = gsap.to(o, {
      v: value,
      duration: 0.75,
      ease: 'power3.out',
      onUpdate: () => {
        shown.current = o.v;
        el.textContent = fmt.current(o.v);
      },
    });
    return () => {
      tween.kill();
    };
  }, [value]);

  return (
    <span ref={ref} className="pl-rolling">
      {initial}
    </span>
  );
}

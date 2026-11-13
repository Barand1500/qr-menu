import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { formatMoney } from '@/lib/api';

interface Receipt {
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  fromEl?: HTMLElement | null;
  stamp: number;
}
export default function TableReceipt({ lang = 'tr' }: { lang?: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const added = (event: Event) => {
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      setReceipt({ ...((event as CustomEvent).detail as Receipt), stamp: performance.now() });
    };
    window.addEventListener('table-order-added', added);
    return () => window.removeEventListener('table-order-added', added);
  }, []);
  useEffect(() => {
    if (!receipt || !ref.current) return;
    const origin =
      receipt.fromEl?.getBoundingClientRect() ||
      document.querySelector('.table-menu__stage')?.getBoundingClientRect();
    const destination = document
      .querySelector('[data-siparis-cart-target]')
      ?.getBoundingClientRect();
    const x = origin ? origin.x + origin.width * 0.55 : innerWidth * 0.5,
      y = origin ? origin.y + origin.height * 0.55 : innerHeight * 0.5;
    const endX = destination ? destination.x + destination.width * 0.5 : innerWidth * 0.6,
      endY = destination ? destination.y + destination.height * 0.5 : innerHeight - 35;
    const animation = ref.current.animate(
      [
        { transform: `translate(${x - 85}px,${y - 50}px) rotate(-7deg) scale(.8)`, opacity: 0 },
        {
          transform: `translate(${x - 85}px,${y - 95}px) rotate(-3deg) scale(1)`,
          opacity: 1,
          offset: 0.35,
        },
        {
          transform: `translate(${endX - 85}px,${endY - 55}px) rotate(8deg) scale(.12)`,
          opacity: 0,
        },
      ],
      { duration: 950, easing: 'cubic-bezier(.22,.7,.3,1)', fill: 'forwards' }
    );
    animation.onfinish = () => setReceipt(null);
    return () => animation.cancel();
  }, [receipt]);
  return receipt ? (
    <div className="table-receipt" ref={ref} aria-hidden="true">
      <span>
        {lang.startsWith('en') ? 'ADDED TO YOUR TABLE' : 'SOFRANIZA EKLENDİ'} <Check size={11} />
      </span>
      <strong>{receipt.name}</strong>
      <small>{formatMoney(receipt.price, receipt.currency)}</small>
    </div>
  ) : null;
}

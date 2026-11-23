import { SIGNATURE_BOX } from '@/lib/contactCard';

type Item = { d: string; delay: number; duration: number };

/** İmza: her çizgi kalemle çiziliyormuş gibi sırayla belirir (stroke-dashoffset). */
export default function ContactCardSignature({ items, animate = true }: { items: Item[]; animate?: boolean }) {
  return (
    <svg
      className="cc-signature"
      viewBox={`0 0 ${SIGNATURE_BOX.width} ${SIGNATURE_BOX.height}`}
      role="img"
      aria-label="İmza"
    >
      {items.map((item, i) => (
        <path
          key={i}
          d={item.d}
          pathLength={1}
          className={animate ? 'cc-signature__stroke' : 'cc-signature__stroke is-static'}
          style={{ animationDelay: `${item.delay}s`, animationDuration: `${item.duration}s` }}
        />
      ))}
    </svg>
  );
}

import { useEffect, useRef, type ReactNode } from 'react';
import { Gamepad2, LayoutGrid, Menu, ShoppingBag, Sparkles } from 'lucide-react';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import { MOBILE_QUERY, prefersReducedMotion, useMedia, useSahneNav } from './shared';
import './sahne.css';
import './sahne-menu.css';

/**
 * Floating tool bar of the menu. Desktop: a dock whose items grow toward the pointer.
 * Mobile: four thumb-sized tabs; Categories opens the full-screen picker.
 */
export default function SahneDock({
  lang,
  onMenu,
  onGames,
  onAssistant,
  onCategories,
  service,
}: {
  lang: string;
  onMenu: () => void;
  onGames?: () => void;
  onAssistant?: () => void;
  onCategories?: () => void;
  service?: ReactNode;
}) {
  const { count, setSheetOpen } = useSiparisCart();
  const nav = useSahneNav();
  const ref = useRef<HTMLElement>(null);
  const mobile = useMedia(ref, MOBILE_QUERY);
  const en = lang.split('-')[0] === 'en';

  useEffect(() => {
    const dock = ref.current;
    if (!dock || mobile || prefersReducedMotion()) return;
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    let frame = 0,
      x = 0;
    const items = () => Array.from(dock.querySelectorAll<HTMLElement>('.sh-dock__item'));
    const paint = () => {
      frame = 0;
      items().forEach((item) => {
        const box = item.getBoundingClientRect();
        const near = Math.max(0, 1 - Math.abs(x - (box.left + box.width / 2)) / 150);
        item.style.setProperty('--s', (1 + near * 0.16).toFixed(3));
      });
    };
    const move = (e: PointerEvent) => {
      x = e.clientX;
      if (!frame) frame = requestAnimationFrame(paint);
    };
    const leave = () => {
      cancelAnimationFrame(frame);
      frame = 0;
      items().forEach((item) => item.style.removeProperty('--s'));
    };
    dock.addEventListener('pointermove', move);
    dock.addEventListener('pointerleave', leave);
    return () => {
      leave();
      dock.removeEventListener('pointermove', move);
      dock.removeEventListener('pointerleave', leave);
    };
  }, [mobile]);

  const cart = (
    <button
      type="button"
      className="sh-dock__item sh-dock__cart"
      onClick={() => setSheetOpen(true)}
      data-siparis-cart-target
    >
      <span className="sh-dock__icon">
        <ShoppingBag size={21} />
        {count > 0 && (
          <b key={count} className="sh-dock__badge">
            {count}
          </b>
        )}
      </span>
      <span>{en ? 'Cart' : 'Sepet'}</span>
    </button>
  );
  const more = (
    <button type="button" className="sh-dock__item" onClick={onMenu}>
      <span className="sh-dock__icon">
        <Menu size={21} />
      </span>
      <span>{en ? 'More' : 'Diğer'}</span>
    </button>
  );
  const waiter = service && <span className="sh-dock__item sh-dock__service">{service}</span>;

  return (
    <nav
      ref={ref}
      className={`sh-dock sh-dock--${mobile ? 'mob' : 'desk'}`}
      aria-label={en ? 'Menu tools' : 'Menü araçları'}
    >
      {mobile ? (
        <>
          <button
            type="button"
            className="sh-dock__item"
            aria-expanded={nav?.open || false}
            onClick={() => {
              onCategories?.();
              nav?.setOpen(!nav.open);
            }}
          >
            <span className="sh-dock__icon">
              <LayoutGrid size={21} />
            </span>
            <span>{en ? 'Categories' : 'Kategoriler'}</span>
          </button>
          {waiter}
          {cart}
          {more}
        </>
      ) : (
        <>
          {more}
          {onGames && (
            <button type="button" className="sh-dock__item" onClick={onGames}>
              <span className="sh-dock__icon">
                <Gamepad2 size={21} />
              </span>
              <span>{en ? 'Games' : 'Oyunlar'}</span>
            </button>
          )}
          {onAssistant && (
            <button type="button" className="sh-dock__item" onClick={onAssistant}>
              <span className="sh-dock__icon">
                <Sparkles size={21} />
              </span>
              <span>{en ? 'What to eat?' : 'Ne yesem?'}</span>
            </button>
          )}
          {waiter}
          {cart}
        </>
      )}
    </nav>
  );
}

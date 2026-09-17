import { useRef, useState, type MouseEvent, type TouchEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { SiparisAddPayload } from '@/lib/siparisCart';

export type StandartChatProduct = SiparisAddPayload & {
  description?: string | null;
  soldOut?: boolean;
};

const SWIPE_OPEN = 88;
const SWIPE_TRIGGER = 72;

export default function StandartChatRow({
  product,
  swipeEnabled = true,
}: {
  product: StandartChatProduct;
  swipeEnabled?: boolean;
}) {
  const navigate = useNavigate();
  const { addItem, enabled } = useSiparisCart();
  const rowRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dragging = useRef(false);
  const axisLocked = useRef<'h' | 'v' | null>(null);
  const [offset, setOffset] = useState(0);
  const [flash, setFlash] = useState(false);
  const soldOut = Boolean(product.soldOut);
  const canSwipe = swipeEnabled && enabled && !soldOut;

  function reset() {
    setOffset(0);
    dragging.current = false;
    axisLocked.current = null;
  }

  function doAdd(fromEl?: HTMLElement | null) {
    if (!canSwipe) return;
    addItem(
      {
        productId: product.productId,
        name: product.name,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        calories: product.calories,
      },
      { fromEl: fromEl || rowRef.current }
    );
    setFlash(true);
    window.setTimeout(() => setFlash(false), 420);
    reset();
  }

  function onTouchStart(e: TouchEvent) {
    if (!canSwipe) return;
    const t = e.touches[0];
    startX.current = t.clientX;
    startY.current = t.clientY;
    dragging.current = true;
    axisLocked.current = null;
  }

  function onTouchMove(e: TouchEvent) {
    if (!dragging.current || !canSwipe) return;
    const t = e.touches[0];
    const dx = t.clientX - startX.current;
    const dy = t.clientY - startY.current;
    if (!axisLocked.current) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      axisLocked.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
    }
    if (axisLocked.current === 'v') {
      dragging.current = false;
      setOffset(0);
      return;
    }
    e.preventDefault();
    // sola kaydır → negatif
    const next = Math.max(-SWIPE_OPEN - 24, Math.min(0, dx));
    setOffset(next);
  }

  function onTouchEnd() {
    if (!canSwipe) {
      reset();
      return;
    }
    if (axisLocked.current === 'v') {
      reset();
      return;
    }
    if (offset <= -SWIPE_TRIGGER) {
      doAdd();
      return;
    }
    // küçük hareket = tık say
    if (Math.abs(offset) < 12 && axisLocked.current !== 'h') {
      navigate(menuProductPath(product.productId));
    }
    reset();
  }

  function onClick(e: MouseEvent) {
    // masaüstü: satıra tık = detay; sağdaki fiyat alanı normal
    if (dragging.current || Math.abs(offset) > 8) {
      e.preventDefault();
      return;
    }
    navigate(menuProductPath(product.productId));
  }

  function onDesktopAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    doAdd(e.currentTarget as HTMLElement);
  }

  return (
    <div
      className={`std-row${soldOut ? ' is-sold-out' : ''}${flash ? ' is-added' : ''}`}
      ref={rowRef}
    >
      <div className="std-row__action" aria-hidden>
        <ShoppingCart className="w-5 h-5" strokeWidth={2.2} />
        <span>Sepete ekle</span>
      </div>
      <div
        className="std-row__front"
        style={{ transform: `translateX(${offset}px)` }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            navigate(menuProductPath(product.productId));
          }
        }}
      >
        <span className="std-row__avatar">
          {product.imageUrl ? (
            <img src={imageUrl(product.imageUrl)} alt="" />
          ) : (
            <MenuMediaPlaceholder kind="product" size="sm" label={product.name} />
          )}
        </span>
        <span className="std-row__body">
          <span className="std-row__name">
            {product.name}
            {soldOut ? <span className="menu-soldout-tag">Bugün bitti</span> : null}
          </span>
          {product.description ? (
            <span className="std-row__preview">{product.description}</span>
          ) : null}
        </span>
        <span className="std-row__meta">
          <span className="std-row__price">{formatMoney(product.price, product.currency)}</span>
          {canSwipe ? (
            <button
              type="button"
              className="std-row__add-btn"
              onClick={onDesktopAdd}
              aria-label={`${product.name} sepete ekle`}
            >
              +
            </button>
          ) : null}
        </span>
      </div>
    </div>
  );
}

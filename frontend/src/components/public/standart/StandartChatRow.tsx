import { useEffect, useRef, useState, type MouseEvent, type TouchEvent } from 'react';
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
  hasOptions?: boolean;
};

const SWIPE_OPEN = 112;
const SWIPE_TRIGGER = 98;
const HINT_OFFSET = -48;

export default function StandartChatRow({
  product,
  swipeEnabled = true,
  showSwipeHint = false,
  onSwipeAdd,
}: {
  product: StandartChatProduct;
  swipeEnabled?: boolean;
  /** İlk girişte hafif sola kaydır ipucu */
  showSwipeHint?: boolean;
  /** Varyantlı ürün için parent modal açabilir; yoksa direkt sepete ekler */
  onSwipeAdd?: (product: StandartChatProduct, fromEl: HTMLElement | null) => void;
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
  const [hinting, setHinting] = useState(false);
  const soldOut = Boolean(product.soldOut);
  const canSwipe = swipeEnabled && enabled && !soldOut;

  useEffect(() => {
    if (!showSwipeHint || !canSwipe) return;
    let t1 = 0;
    let t2 = 0;
    t1 = window.setTimeout(() => {
      setHinting(true);
      setOffset(HINT_OFFSET);
      t2 = window.setTimeout(() => {
        setOffset(0);
        setHinting(false);
      }, 900);
    }, 380);
    return () => {
      window.clearTimeout(t1);
      window.clearTimeout(t2);
    };
  }, [showSwipeHint, canSwipe, product.productId]);

  function reset() {
    setOffset(0);
    dragging.current = false;
    axisLocked.current = null;
  }

  function doAdd(fromEl?: HTMLElement | null) {
    if (!canSwipe) return;
    if (onSwipeAdd) {
      onSwipeAdd(product, fromEl || rowRef.current);
      reset();
      return;
    }
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
    setHinting(false);
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
    if (offset <= -SWIPE_TRIGGER && axisLocked.current === 'h') {
      doAdd();
      return;
    }
    // Küçük kaydırma / dokunuş = sepete ekleme; detaya git
    if (Math.abs(offset) < 28) {
      navigate(menuProductPath(product.productId));
    }
    reset();
  }

  function onClick(e: MouseEvent) {
    if (dragging.current || Math.abs(offset) > 8 || hinting) {
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

  const revealing = offset < -4 || hinting;

  return (
    <div
      className={`std-row${soldOut ? ' is-sold-out' : ''}${flash ? ' is-added' : ''}${
        revealing ? ' is-revealing' : ''
      }${hinting ? ' is-hinting' : ''}`}
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

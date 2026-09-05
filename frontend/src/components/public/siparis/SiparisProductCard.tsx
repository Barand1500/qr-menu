import type { MouseEvent } from 'react';
import { useRef } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';
import SiparisKcal from '@/components/public/siparis/SiparisKcal';
import { useSiparisCart } from '@/hooks/useSiparisCart';
import type { SiparisAddPayload } from '@/lib/siparisCart';

export type SiparisProductCardItem = SiparisAddPayload & {
  description?: string | null;
};

export default function SiparisProductCard({
  product,
  compact,
}: {
  product: SiparisProductCardItem;
  compact?: boolean;
}) {
  const { addItem } = useSiparisCart();
  const mediaRef = useRef<HTMLAnchorElement>(null);
  const addBtnRef = useRef<HTMLButtonElement>(null);

  function onAdd(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    addItem(
      {
        productId: product.productId,
        name: product.name,
        price: product.price,
        currency: product.currency,
        imageUrl: product.imageUrl,
        calories: product.calories,
      },
      { fromEl: mediaRef.current || addBtnRef.current }
    );
  }

  return (
    <article className={`siparis-card${compact ? ' siparis-card--compact' : ''}`}>
      <Link
        ref={mediaRef}
        to={menuProductPath(product.productId)}
        className="siparis-card__media"
      >
        {product.imageUrl ? (
          <img src={imageUrl(product.imageUrl)} alt="" />
        ) : (
          <MenuMediaPlaceholder kind="product" size="lg" label={product.name} />
        )}
      </Link>
      <div className="siparis-card__body">
        <Link to={menuProductPath(product.productId)} className="siparis-card__name">
          {product.name}
        </Link>
        {product.calories != null && product.calories > 0 ? (
          <p className="siparis-card__kcal-wrap">
            <SiparisKcal calories={product.calories} />
          </p>
        ) : null}
        <div className="siparis-card__row">
          <span className="siparis-card__price">
            {formatMoney(product.price, product.currency)}
          </span>
          <button
            ref={addBtnRef}
            type="button"
            className="siparis-card__add"
            onClick={onAdd}
            aria-label={`${product.name} sepete ekle`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      </div>
    </article>
  );
}

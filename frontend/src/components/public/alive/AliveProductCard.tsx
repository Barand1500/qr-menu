import { Link } from 'react-router-dom';
import { Flame, Plus, Star } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

export type AliveProductCardItem = {
  id: number;
  name: string;
  description?: string | null;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  calories?: number | null;
  isRecommended?: boolean;
};

export default function AliveProductCard({ product }: { product: AliveProductCardItem }) {
  const kcal = product.calories != null && product.calories > 0 ? product.calories : null;

  return (
    <article className="alive-card">
      <Link to={menuProductPath(product.id)} className="alive-card__media">
        {product.imageUrl ? (
          <img src={imageUrl(product.imageUrl)} alt="" />
        ) : (
          <MenuMediaPlaceholder kind="product" size="lg" label={product.name} />
        )}
      </Link>
      <div className="alive-card__panel">
        <Link to={menuProductPath(product.id)} className="alive-card__name">
          {product.name}
        </Link>
        <p className="alive-card__price">{formatMoney(product.price, product.currency)}</p>
        <div className="alive-card__meta">
          {product.isRecommended ? (
            <span className="alive-card__badge">
              <Star className="w-3 h-3" fill="currentColor" />
              Önerilen
            </span>
          ) : kcal != null ? (
            <span className="alive-card__badge alive-card__badge--kcal">
              <Flame className="w-3 h-3" />
              {kcal} kcal
            </span>
          ) : (
            <span />
          )}
          <Link
            to={menuProductPath(product.id)}
            className="alive-card__plus"
            aria-label={`${product.name} detay`}
          >
            <Plus className="w-4 h-4" strokeWidth={2.75} />
          </Link>
        </div>
      </div>
    </article>
  );
}

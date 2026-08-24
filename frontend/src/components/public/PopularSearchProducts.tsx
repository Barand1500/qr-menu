import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';

export interface PopularProduct {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  groupId: number;
  groupName: string;
}

interface PopularSearchProductsProps {
  products: PopularProduct[];
  onNavigate?: () => void;
  compact?: boolean;
}

export default function PopularSearchProducts({
  products,
  onNavigate,
  compact,
}: PopularSearchProductsProps) {
  if (products.length === 0) return null;

  return (
    <div className={`public-popular-search${compact ? ' public-popular-search--compact' : ''}`}>
      <div className="public-popular-search__head">
        <Flame className="w-4 h-4" />
        <span>Popüler ürünler</span>
      </div>
      <div className="public-popular-search__list">
        {products.map((p) => (
          <Link
            key={p.id}
            to={menuProductPath(p.id)}
            className="public-popular-search__item"
            onClick={onNavigate}
          >
            {p.imageUrl ? (
              <img src={imageUrl(p.imageUrl)} alt="" className="public-popular-search__img" />
            ) : (
              <div className="public-popular-search__img public-popular-search__img--empty" />
            )}
            <div className="public-popular-search__meta">
              <span className="public-popular-search__name">{p.name}</span>
              <span className="public-popular-search__price">{formatMoney(p.price, p.currency)}</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

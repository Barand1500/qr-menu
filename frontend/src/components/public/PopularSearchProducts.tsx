import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

export interface PopularProduct {
  id: number;
  name: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
  groupId: number;
  groupName: string;
  allergens?: string | null;
  allergenTags?: string[];
  isVegan?: boolean;
  isVegetarian?: boolean;
  isGlutenFree?: boolean;
  isDiabetic?: boolean;
}

interface PopularSearchProductsProps {
  products: PopularProduct[];
  onNavigate?: () => void;
  compact?: boolean;
  title?: string;
}

export default function PopularSearchProducts({
  products,
  onNavigate,
  compact,
  title = 'Popüler ürünler',
}: PopularSearchProductsProps) {
  if (products.length === 0) return null;

  return (
    <div className={`public-popular-search${compact ? ' public-popular-search--compact' : ''}`}>
      <div className="public-popular-search__head">
        <Flame className="public-popular-search__icon" aria-hidden />
        <span>{title}</span>
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
              <img src={imageUrl(p.imageUrl)} alt="" className="public-popular-search__thumb" />
            ) : (
              <div className="public-popular-search__thumb public-popular-search__thumb--empty">
                <MenuMediaPlaceholder kind="product" size="sm" label={p.name} />
              </div>
            )}
            <div className="public-popular-search__meta">
              <span className="public-popular-search__name">{p.name}</span>
              {p.groupName ? (
                <span className="public-popular-search__group">{p.groupName}</span>
              ) : null}
            </div>
            <span className="public-popular-search__price">{formatMoney(p.price, p.currency)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

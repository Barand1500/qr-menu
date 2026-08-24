import { Link } from 'react-router-dom';
import { Flame } from 'lucide-react';
import { formatPrice, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';

export interface PopularProduct {
  id: number;
  name: string;
  price: number;
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
  compact = false,
}: PopularSearchProductsProps) {
  if (products.length === 0) return null;

  return (
    <div className={`public-popular-search ${compact ? 'public-popular-search--compact' : ''}`}>
      <p className="public-popular-search__title">
        <Flame className="w-4 h-4 text-orange-500" />
        Müşterilerimiz en çok bunları yiyor
      </p>
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
              <div className="public-popular-search__thumb public-popular-search__thumb--empty" />
            )}
            <div className="min-w-0 flex-1">
              <p className="public-popular-search__name">{p.name}</p>
              <p className="public-popular-search__meta">{p.groupName}</p>
            </div>
            <span className="public-popular-search__price">{formatPrice(p.price)} ₺</span>
          </Link>
        ))}
      </div>
    </div>
  );
}

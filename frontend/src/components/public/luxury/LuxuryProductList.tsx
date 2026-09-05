import { useState } from 'react';
import { Link } from 'react-router-dom';
import { formatMoney, imageUrl } from '@/lib/api';
import { menuProductPath } from '@/lib/menuPaths';
import MenuMediaPlaceholder from '@/components/public/MenuMediaPlaceholder';

export type LuxuryListProduct = {
  id: number;
  name: string;
  description?: string;
  price: number;
  currency?: { code?: string; symbol?: string } | null;
  imageUrl?: string | null;
};

export type LuxurySubgroup = {
  id: number;
  name: string;
  imageUrl?: string | null;
  products: LuxuryListProduct[];
};

function ProductRows({ products }: { products: LuxuryListProduct[] }) {
  return (
    <>
      {products.map((p) => (
        <Link key={p.id} to={menuProductPath(p.id)} className="luxury-product-row">
          <div className="luxury-product-row__media">
            {p.imageUrl ? (
              <img src={imageUrl(p.imageUrl)} alt="" />
            ) : (
              <MenuMediaPlaceholder kind="product" size="lg" label={p.name} />
            )}
          </div>
          <div className="luxury-product-row__body">
            <h3>{p.name}</h3>
            {p.description ? <p>{p.description}</p> : null}
            <span className="luxury-product-row__price">
              {formatMoney(p.price, p.currency)}
            </span>
          </div>
        </Link>
      ))}
    </>
  );
}

export default function LuxuryProductList({
  products,
  subgroups = [],
  groupName,
}: {
  products: LuxuryListProduct[];
  subgroups?: LuxurySubgroup[];
  groupName: string;
}) {
  const [activeSub, setActiveSub] = useState<'all' | number>('all');
  const hasSubs = subgroups.length > 0;
  const showParent = activeSub === 'all' && products.length > 0;
  const visibleSubs =
    activeSub === 'all' ? subgroups : subgroups.filter((s) => s.id === activeSub);

  return (
    <div className="luxury-product-list">
      <header className="luxury-product-list__head">
        <p className="luxury-eyebrow">Menü</p>
        <h1>{groupName}</h1>
        <span className="luxury-rule" aria-hidden />
      </header>

      {hasSubs ? (
        <div className="luxury-list__subnav" role="tablist" aria-label="Alt kategoriler">
          <button
            type="button"
            role="tab"
            aria-selected={activeSub === 'all'}
            className={`luxury-list__subpill${activeSub === 'all' ? ' is-active' : ''}`}
            onClick={() => setActiveSub('all')}
          >
            Tümü
          </button>
          {subgroups.map((s) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={activeSub === s.id}
              className={`luxury-list__subpill${activeSub === s.id ? ' is-active' : ''}`}
              onClick={() => setActiveSub(s.id)}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}

      {showParent ? <ProductRows products={products} /> : null}

      {visibleSubs.map((sub) => (
        <div key={sub.id} className="luxury-list__section" id={`lux-sub-${sub.id}`}>
          {activeSub === 'all' ? (
            <div className="luxury-list__subhead">
              <span className="luxury-rule" aria-hidden />
              <h2>{sub.name}</h2>
              <span className="luxury-rule" aria-hidden />
            </div>
          ) : null}
          <ProductRows products={sub.products} />
        </div>
      ))}

      {!showParent && visibleSubs.length === 0 && products.length > 0 ? (
        <ProductRows products={products} />
      ) : null}
    </div>
  );
}
